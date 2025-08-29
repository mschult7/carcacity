/**
 * User Controller
 * Handles user-related socket events: join, leave, disconnect, robots, etc.
 */

const { gameState, getColor, returnColor } = require('../models/game-state');
const config = require('../config/server-config');
const helpers = require('../utils/helpers');

/**
 * Add a new user to the game
 * @param {string} clientId - Client ID
 * @param {string} socketId - Socket ID
 * @param {string} name - User name
 * @param {object} io - Socket.IO instance
 */
function addUser(clientId, socketId, name, io) {
  // Determine join type
  let joinType = 'joining';
  if (gameState.users[clientId]) {
    joinType = gameState.users[clientId].connected === false ? 'rejoining' : 'joining';
  }
  
  const userIndex = Object.values(gameState.users).length;
  gameState.users[clientId] = {
    clientId,
    name,
    socketId: socketId,
    page: gameState.users[clientId]?.page || 'lobby',
    connected: true,
    robot: false,
    isTurn: gameState.users[clientId]?.isTurn || false,
    lastTile: gameState.users[clientId]?.lastTile || [],
    color: gameState.users[clientId]?.color || getColor(userIndex),
    score: gameState.users[clientId]?.score || 0,
    difficulty: gameState.users[clientId]?.difficulty || 0,
    lastSeen: Date.now(),
  };
  
  gameState.ROBOT_SPEED = config.INITIAL_ROBOT_SPEED;
  console.log(`User ${joinType}: ${name} (clientId ${clientId}, socket ${socketId})`);
  io.emit('users', helpers.formatUsersForEmission(gameState.users));
}

/**
 * Add a new spectator
 * @param {string} clientId - Client ID
 * @param {string} socketId - Socket ID
 * @param {object} io - Socket.IO instance
 */
function addSpectator(clientId, socketId, io) {
  // Determine join type
  let joinType = 'joining';
  if (gameState.users[clientId] || gameState.spectators[clientId]) {
    if (gameState.users[clientId]) {
      joinType = gameState.users[clientId].connected === false ? 'rejoining' : 'joining';
    } else {
      joinType = gameState.spectators[clientId].connected === false ? 'rejoining' : 'joining';
    }
  }
  
  gameState.spectators[clientId] = {
    clientId,
    socketId: socketId,
    page: gameState.spectators[clientId]?.page || 'game',
    connected: true,
    robot: false,
    isTurn: false,
    lastTile: [],
    color: '',
    score: 0,
    difficulty: 0,
    lastSeen: Date.now(),
  };
  
  console.log(`Spectator ${joinType}: (clientId ${clientId}, socket ${socketId})`);
  io.emit('spectators', Object.values(gameState.spectators));
}

/**
 * Handle player registration (auto-named)
 * @param {object} socket - Socket instance
 * @param {string} clientId - Client ID
 * @param {object} io - Socket.IO instance
 */
function handlePlayerJoin(socket, clientId, io) {
  if (!clientId) return;
  
  let addUserNeeded = true;
  const userIndex = Object.values(gameState.users).length;
  let name = `Player ${userIndex + 1}`;
  
  if (gameState.users[clientId]) {
    gameState.users[clientId].lastSeen = Date.now();
    // If user was previously disconnected, it's a rejoin
    if (!gameState.users[clientId].connected) {
      addUserNeeded = false;
      gameState.users[clientId].connected = true;
      gameState.users[clientId].robot = false;
    }

    if (gameState.users[clientId].socketId === socket.id) {
      addUserNeeded = false;
    }
  }
  
  if (userIndex + 1 <= config.MAX_PLAYERS && (!gameState.gameStarted || gameState.checkMate) && addUserNeeded) {
    if (gameState.spectators[clientId]) {
      delete gameState.spectators[clientId];
    }
    addUser(clientId, socket.id, name, io);
  } else {
    if (gameState.spectators[clientId]) {
      if (gameState.spectators[clientId].socketId !== socket.id) {
        addUserNeeded = false;
      }
    }
    if (addUserNeeded) {
      addSpectator(clientId, socket.id, io);
    }
  }
}

/**
 * Handle custom user registration (with name)
 * @param {object} socket - Socket instance
 * @param {string} name - User name
 * @param {string} clientId - Client ID
 * @param {object} io - Socket.IO instance
 */
function handleUserJoin(socket, name, clientId, io) {
  if (!name || !clientId) return;
  
  let addUserNeeded = true;
  const userIndex = Object.values(gameState.users).length;
  
  if ((userIndex + 1 <= config.MAX_PLAYERS && !gameState.gameStarted) || gameState.users[clientId]) {
    if (gameState.users[clientId]) {
      if (gameState.users[clientId].socketId === socket.id && gameState.users[clientId].name === name) {
        gameState.users[clientId].lastSeen = Date.now();
        addUserNeeded = false;
      }
    }
    if (addUserNeeded) {
      addUser(clientId, socket.id, name, io);
    }
  } else {
    if (gameState.spectators[clientId]) {
      gameState.spectators[clientId].lastSeen = Date.now();
    } else {
      addSpectator(clientId, socket.id, io);
    }
  }
}

/**
 * Handle robot creation
 * @param {object} io - Socket.IO instance
 */
function handleRobotCreation(io) {
  const robotNumber = helpers.findAvailableRobotNumber(gameState.users, config.MAX_PLAYERS);
  
  if (robotNumber) {
    const robotId = helpers.generateRobotId(robotNumber);
    const userIndex = Object.values(gameState.users).length;

    gameState.users[robotId] = {
      clientId: robotId,
      name: `Robot ${robotNumber}`,
      socketId: null,
      page: 'lobby',
      connected: true,
      robot: true,
      isTurn: false,
      lastTile: [],
      color: getColor(userIndex),
      score: 0,
      difficulty: 3,
      lastSeen: Date.now(),
    };

    io.emit('users', helpers.formatUsersForEmission(gameState.users));
    const connectedUsers = Object.values(gameState.users).filter(u => !u.robot);
    const userIndex2 = Object.values(connectedUsers).length;
    if (userIndex2 === 0) {
      gameState.ROBOT_SPEED = config.INITIAL_ROBOT_SPEED / 6;
    }
  }
}

/**
 * Handle robotify (make all users robots)
 * @param {object} io - Socket.IO instance
 */
function handleRobotifyAll(io) {
  Object.keys(gameState.users).forEach(clientId => {
    if (gameState.users[clientId].robot !== true) {
      gameState.users[clientId].robot = true;
      gameState.users[clientId].difficulty = 3;
    }
  });
  gameState.ROBOT_SPEED = 100;
  io.emit('users', Object.values(gameState.users));
}

/**
 * Handle user page update
 * @param {object} socket - Socket instance
 * @param {string} page - New page
 * @param {object} io - Socket.IO instance
 */
function handlePageUpdate(socket, page, io) {
  const clientId = helpers.findUserBySocketId(gameState.users, socket.id);
  if (clientId) {
    gameState.users[clientId].lastSeen = Date.now();
    gameState.users[clientId].page = page;
    io.emit('users', helpers.formatUsersForEmission(gameState.users));
    console.log(`User ${gameState.users[clientId].name} updated page: ${page}`);
  }
}

/**
 * Handle user removal
 * @param {object} user - User to remove
 * @param {object} io - Socket.IO instance
 */
function handleUserRemoval(user, io) {
  if (gameState.users[user.clientId]) {
    returnColor(gameState.users[user.clientId].color);
    delete gameState.users[user.clientId];
  }
  io.emit('users', Object.values(gameState.users));
}

/**
 * Handle user leave
 * @param {object} socket - Socket instance
 * @param {object} io - Socket.IO instance
 */
function handleUserLeave(socket, io) {
  const clientId = helpers.findUserBySocketId(gameState.users, socket.id);
  if (clientId) {
    returnColor(gameState.users[clientId].color);
    delete gameState.users[clientId];
  }
  io.emit('users', Object.values(gameState.users));
}

/**
 * Handle user disconnect
 * @param {object} socket - Socket instance
 * @param {object} io - Socket.IO instance
 */
function handleUserDisconnect(socket, io) {
  const clientId = helpers.findUserBySocketId(gameState.users, socket.id);
  if (clientId) {
    gameState.users[clientId] = {
      clientId,
      name: gameState.users[clientId]?.name,
      socketId: socket.id,
      page: gameState.users[clientId]?.page,
      connected: false,
      robot: false,
      isTurn: gameState.users[clientId]?.isTurn,
      lastTile: gameState.users[clientId]?.lastTile,
      color: gameState.users[clientId]?.color,
      score: gameState.users[clientId]?.score,
      difficulty: gameState.users[clientId]?.difficulty,
      lastSeen: gameState.users[clientId]?.lastSeen,
    };
    
    console.log(`User disconnected: ${gameState.users[clientId].name}`);
    io.emit('users', helpers.formatUsersForEmission(gameState.users));
    
    const connectedUsers = Object.values(gameState.users).filter(u => !u.robot);
    const userIndex = Object.values(connectedUsers).length;
    if (userIndex === 0) {
      gameState.ROBOT_SPEED = config.INITIAL_ROBOT_SPEED / 6;
    }
  }
}

/**
 * Handle clear all users (admin action)
 * @param {object} io - Socket.IO instance
 */
function handleClearAll(io) {
  Object.keys(gameState.users).forEach(clientId => {
    gameState.users[clientId].page = "lobby";
  });

  io.emit('users', helpers.formatUsersForEmission(gameState.users));

  for (const sockId of Object.keys(io.sockets.sockets)) {
    const sock = io.sockets.sockets.get(sockId);
    if (sock) sock.disconnect(true);
  }

  for (const id in gameState.users) delete gameState.users[id];
  gameState.defaultColors = [...config.DEFAULT_COLORS];
  gameState.gameStarted = false;
  io.emit('users', []);
  io.emit('gameStarted', gameState.gameStarted);
  console.log('All users cleared.');
}

/**
 * Handle user list request
 * @param {object} socket - Socket instance
 */
function handleUserList(socket) {
  const clientId = helpers.findUserBySocketId(gameState.users, socket.id);
  if (clientId) {
    gameState.users[clientId].lastSeen = Date.now();
  } else if (gameState.spectators[socket.id]) {
    gameState.spectators[socket.id].lastSeen = Date.now();
  }
}

module.exports = {
  addUser,
  addSpectator,
  handlePlayerJoin,
  handleUserJoin,
  handleRobotCreation,
  handleRobotifyAll,
  handlePageUpdate,
  handleUserRemoval,
  handleUserLeave,
  handleUserDisconnect,
  handleClearAll,
  handleUserList
};