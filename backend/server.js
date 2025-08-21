/**
 * City Game Socket.IO Server
 * 
 * Goal: Reorganized for clarity without changing ANY functional code.
 * - Grouped constants, server setup, and state together.
 * - Grouped Socket.IO events by category: USER ACTIONS vs GAME ACTIONS.
 * - Kept original code and logic intact; added comments and structured sections.
 */

const express = require('express');
const http = require('http');
const { connected } = require('process');
const { Server } = require('socket.io');

/* =========================
 * Server and Socket Setup
 * ========================= */
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  path: '/cityapi',
  cors: { origin: 'https://panther01.ddns.net' },
});
/* =========================
 * Rate Limiting (Per-IP)
 * ========================= */

// Store request counts per IP
const rateLimit = {};
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // Max 100 requests per IP per minute

io.use((socket, next) => {
  const ip = socket.handshake.address;

  if (!rateLimit[ip]) {
    rateLimit[ip] = { count: 0, timer: null };
  }

  rateLimit[ip].count++;

  if (rateLimit[ip].count > RATE_LIMIT_MAX_REQUESTS) {
    console.log(`Rate limit exceeded for IP: ${ip}`);
    return next(new Error('Rate limit exceeded. Please try again later.'));
  }

  // Reset the rate limit count after the window expires
  if (!rateLimit[ip].timer) {
    rateLimit[ip].timer = setTimeout(() => {
      delete rateLimit[ip];
    }, RATE_LIMIT_WINDOW_MS);
  }

  next();
});
/* =========================
 * Global State and Helpers
 * ========================= */

// Map clientId -> { name, socketId, page, connected }
const users = {};
const spectators = {};
const BOARD_SIZE = 21;
let gameStarted = false;
let sequence = 0;
let usersTurn = -1;
let lastUser = -1;

// Initial board scaffold (will be reset by clearBoard() below)
let board = Array(BOARD_SIZE)
  .fill(null)
  .map(() =>
    Array(BOARD_SIZE).fill({ player: null, index: null, enabled: false, sequence: null })
  );

// Tracks which tiles can be clicked next
let enabledTiles = []; // Array to track enabled tiles

// Player colors (cycled)
const defaultColors = ['#3b9774', '#ff9671', '#845ec2', '#FFDB58', '#3498db'];

// Get a color for a given user index
function getColor(idx) {
  return defaultColors.shift();
}

// Initialize board and broadcast initial state
clearBoard();

/* =========================
 * Socket.IO Connection
 * ========================= */
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  /* =========================
   * USER ACTIONS (join/leave, robots, presence, pages)
   * ========================= */

  // Register or update user (auto-named Player N)
  socket.on('player', ({ clientId }) => {
    if (!clientId) return;

    // Determine join type
    let joinType = 'joining';
    if (users[clientId]) {
      // If user was previously disconnected, it's a rejoin
      joinType = users[clientId].connected === false ? 'rejoining' : 'joining';
    }

    const connectedUsers = Object.values(users).filter(u => !u.robot);
    const userIndex = Object.values(users).length;
    console.log(`index: ${userIndex} | ${defaultColors[userIndex % defaultColors.length]}`);
    if (connectedUsers.length < 5) {
      let name = `Player ${connectedUsers.length + 1}`;
      users[clientId] = {
        clientId,
        name,
        socketId: socket.id,
        page: users[clientId]?.page || 'lobby',
        connected: true,
        robot: false,
        isTurn: users[clientId]?.isTurn || false,
        lastTile: users[clientId]?.lastTile || [],
        color: users[clientId]?.color || getColor(userIndex),
      };

      console.log(`User ${joinType}: ${name} (clientId ${clientId}, socket ${socket.id})`);
      io.emit('users', Object.entries(users).map(([id, u]) => ({ clientId: id, ...u })));
    } else {
      spectators[clientId] = {
        clientId,
        socketId: socket.id,
        page: 'game',
        connected: true,
        robot: false,
      };
    }
  });

  // Register or update user (custom name)
  socket.on('join', ({ name, clientId }) => {
    if (!name || !clientId) return;

    // Determine join type
    let joinType = 'joining';
    if (users[clientId]) {
      // If user was previously disconnected, it's a rejoin
      joinType = users[clientId].connected === false ? 'rejoining' : 'joining';
    }

    const userIndex = Object.values(users).length;
    console.log(`index: ${userIndex} | ${defaultColors[userIndex % defaultColors.length]}`);
    users[clientId] = {
      clientId,
      name,
      socketId: socket.id,
      page: users[clientId]?.page || 'lobby',
      connected: true,
      robot: false,
      isTurn: users[clientId]?.isTurn || false,
      lastTile: users[clientId]?.lastTile || [],
      color: users[clientId]?.color || getColor(userIndex),
    };

    console.log(`User ${joinType}: ${name} (clientId ${clientId}, socket ${socket.id})`);
    io.emit('users', Object.entries(users).map(([id, u]) => ({ clientId: id, ...u })));
  });

  // Add a robot user (virtual player)
  socket.on('robot', () => {
    const connectedUsers = Object.values(users).filter(u => u.connected);
    const connectedRobots = connectedUsers.filter(u => u.robot);

    if (connectedUsers.length < 5) {
      let robotNumber = 1;
      while (connectedRobots.some(r => r.name === `Robot ${robotNumber}`) && robotNumber <= 5) {
        robotNumber++;
      }

      if (robotNumber <= 5) {
        const robotId = `robot_${robotNumber}_${Date.now()}`;
        const userIndex = Object.values(users).length;
        console.log(`index: ${userIndex} | ${defaultColors[userIndex % defaultColors.length]}`);
        users[robotId] = {
          clientId: robotId,
          name: `Robot ${robotNumber}`,
          socketId: null,
          page: 'lobby',
          connected: true,
          robot: true,
          isTurn: false,
          lastTile: [],
          color: getColor(userIndex),
        };

        console.log(`Virtual robot added: Robot ${robotNumber} (clientId ${robotId})`);
        io.emit('users', Object.entries(users).map(([id, u]) => ({ clientId: id, ...u })));
      }
    }
  });

  // Broadcast current users list
  socket.on('list', () => {
    io.emit('users', Object.values(users));
    io.emit('spectators', Object.values(spectators));
  });

  // Update user's current page
  socket.on('updatePage', (page) => {
    const clientId = Object.keys(users).find(id => users[id].socketId === socket.id);
    if (clientId) {
      users[clientId].page = page;
      io.emit('users', Object.entries(users).map(([id, u]) => ({ clientId: id, ...u })));
      console.log(`User ${users[clientId].name} updated page: ${page}`);
    }
  });

  // Remove a specific user (admin action)
  socket.on('remove', (user) => {
    if (users[user.clientId]) {
      defaultColors.push(users[user.clientId].color);
      delete users[user.clientId];
      io.emit('users', Object.values(users));
    }
  });

  // User leaves (self-removal)
  socket.on('leave', () => {
    const clientId = Object.keys(users).find(id => users[id].socketId === socket.id);
    if (clientId) {
      console.log(`User left: ${users[clientId].name}`);
      // for (let row = 0; row < BOARD_SIZE; row++) {
      //   for (let col = 0; col < BOARD_SIZE; col++) {
      //     if (board[row][col].player === clientId) {
      //       board[row][col] = { player: null, index: null, sequence: board[row][col].sequence, enabled: board[row][col].enabled };
      //       disableIfValid(row + 1, col);
      //       disableIfValid(row - 1, col);
      //       disableIfValid(row, col + 1);
      //       disableIfValid(row, col - 1);
      //     }
      //   }
      // }
      defaultColors.push(users[clientId].color);
      delete users[clientId];
    }
    io.emit('users', Object.values(users));
  });

  // Mark user as disconnected (do not delete; supports rejoin)
  socket.on('disconnect', () => {
    const clientId = Object.keys(users).find(id => users[id].socketId === socket.id);
    if (clientId) {
      users[clientId].connected = false;
      console.log(`User disconnected: ${users[clientId].name}`);
      io.emit('users', Object.entries(users).map(([id, u]) => ({ clientId: id, ...u })));
    }
  });

  // Clear all users and reset server state (admin action)
  socket.on('clearAll', () => {
    Object.keys(users).forEach(clientId => {
      users[clientId].page = "lobby";
    });

    io.emit('users', Object.entries(users).map(([id, u]) => ({ clientId: id, ...u })));

    for (const sockId of Object.keys(io.sockets.sockets)) {
      const sock = io.sockets.sockets.get(sockId);
      if (sock) sock.disconnect(true);
    }

    for (const id in users) delete users[id];
    gameStarted = false;
    io.emit('users', []);
    io.emit('gameStarted', gameStarted);
    console.log('All users cleared.');
  });

  /* =========================
   * GAME ACTIONS (game lifecycle, board, turn, tiles)
   * ========================= */

  // Start the game: move lobby users to game, enable initial tiles, set first turn
  socket.on('start', () => {
    const clientId = Object.keys(users).find(id => users[id].socketId === socket.id);
    console.log(`User ${users[clientId].name} started the game.`);
    gameStarted = true;

    for (const [clientId, user] of Object.entries(users)) {
      if (user.page === 'lobby') {
        user.page = 'game';
        console.log(`${user.name} moved to the game page.`);
      }
    }

    enableIfValid(11, 10);
    enableIfValid(9, 10);
    enableIfValid(10, 11);
    enableIfValid(10, 9);

    toggleTurn();

    io.emit('gameStarted', gameStarted);
  });

  // Report current game status (started/not)
  socket.on('status', () => {
    io.emit('gameStarted', gameStarted);
  });

  // Handle tile clicks (human players)
  socket.on('clickTile', ({ row, col, player, index }) => {
    if (!player) return;
    if (!board[row][col].player) {
      const userIds = Object.keys(users);
      if (usersTurn < 0 || usersTurn >= userIds.length) return;

      const currentUserId = userIds[usersTurn];
      users[currentUserId].lastTile = [row, col];
      console.log(`Tile Clicked: [${row}, ${col}] ${player}`);
      board[row][col] = { player, index, enabled: false, sequence: sequence, color: users[currentUserId].color, row: row, col: col };
      sequence = sequence + 1;


      enableIfValid(row + 1, col);
      enableIfValid(row - 1, col);
      enableIfValid(row, col + 1);
      enableIfValid(row, col - 1);
      disableIfValid(row, col);
      toggleTurn();
      io.emit('boardUpdate', board);
    }
  });

  // Return full board state to clients
  socket.on('getBoard', () => {
    io.emit('boardUpdate', board);
  });

  // Return current turn info to clients
  socket.on('getTurn', () => {
    //console.log(JSON.stringify(users, null, 2));
    const userIds = Object.keys(users);
    if (usersTurn < 0 || usersTurn >= userIds.length) {
      io.emit('turn', {

        name: 'NA', // Pass only the user's name
        usersTurn: usersTurn // Include the usersTurn variable
      });
    }
    const currentUserId = userIds[usersTurn];
    io.emit('turn', {

      name: users[currentUserId]?.name, // Pass only the user's name
      usersTurn: usersTurn // Include the usersTurn variable
    });
  });

  // Reset the board only (keep players)
  socket.on('clearBoard', () => {
    clearBoard();
  });

  // End the game: return users to lobby and reset board/state
  socket.on('endGame', () => {
    Object.keys(users).forEach(clientId => {
      users[clientId].page = "lobby";
    });

    io.emit('users', Object.entries(users).map(([id, u]) => ({ clientId: id, ...u })));
    clearBoard();
    gameStarted = false;
    io.emit('gameStarted', gameStarted);
    console.log('Game Ended.');
  });

  // Send initial board state on connect
  socket.emit('boardUpdate', board);
});

/* =========================
 * Board and Tile Utilities
 * ========================= */

// Safely enable a tile and update enabledTiles array
function enableIfValid(r, c) {
  if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
    if (board[r][c].sequence === null && !board[r][c].enabled) {
      board[r][c].enabled = true;
      enabledTiles.push({ row: r, col: c });
      //console.log(`adding to enabled tile row:${r} col: ${c}`);
    }
  }
}

// Safely disable a tile and update enabledTiles array
function disableIfValid(r, c) {
  if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
    // Find the index of the tile in the enabledTiles array
    const index = enabledTiles.findIndex(tile => tile.row === r && tile.col === c);
    if (index !== -1) {
      // Remove the tile from the array using splice
      //console.log(`splicing from enabled tile (${index}) row:${r} col: ${c}`);
      enabledTiles.splice(index, 1);
      if (board[r][c].sequence === null && board[r][c].enabled) {
        board[r][c].enabled = false;
      }
    }
  }
}

// Clear and reinitialize the board state; also resets turn and game flags
function clearBoard() {
  board = Array(BOARD_SIZE)
    .fill(null)
    .map(() =>
      Array(BOARD_SIZE)
        .fill(null)
        .map(() => ({ player: null, index: null, enabled: false, sequence: null }))
    );

  enabledTiles = [];
  board[10][10] = { player: 'board', index: -1 };
  sequence = 0;
  usersTurn = -1;
  gameStarted = false;
  io.emit('boardUpdate', board);
  console.log('Board cleared');
}

/* =========================
 * Turn and Robot Utilities
 * ========================= */

// Simple sleep helper for async delays
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Robot loop: every 1.5s, if it's a robot's turn, play a random enabled tile
async function robotTurn() {
  setInterval(async () => {
    const userIds = Object.keys(users);
    if (usersTurn < 0 || usersTurn >= userIds.length) return;

    const currentUserId = userIds[usersTurn];
    const currentUser = users[currentUserId];

    if (currentUser && currentUser.robot) {
      // if (lastUser >= 0 && lastUser < userIds.length) {
      //   const lastUserId = userIds[lastUser];
      //   const lastUserOB = users[lastUserId];
      //   if (!lastUserOB.robot) {
      //     await sleep(1500); // clankerTax
      //   }
      // }
      console.log(`Robot ${currentUser.name}'s turn`);

      if (enabledTiles.length === 0) return;

      const randomTile = enabledTiles[Math.floor(Math.random() * enabledTiles.length)];
      const { row, col } = randomTile;

      console.log(`Robot ${currentUser.name} clicks tile [${row}, ${col}]`);
      board[row][col] = {
        player: currentUserId,
        index: usersTurn,
        enabled: false,
        sequence: sequence,
        color: currentUser.color,
        row: row,
        col: col,
      };
      users[currentUserId].lastTile = [row, col];

      enableIfValid(row + 1, col);
      enableIfValid(row - 1, col);
      enableIfValid(row, col + 1);
      enableIfValid(row, col - 1);

      disableIfValid(row, col);
      sequence++;
      toggleTurn();
      io.emit('boardUpdate', board);
    }
  }, 1500);
}

// Advance to the next user's turn and broadcast
function toggleTurn() {
  const userIds = Object.keys(users);
  lastUser = usersTurn;
  if (usersTurn < 0) {
    usersTurn = 0;
  } else if (usersTurn < userIds.length - 1) {
    usersTurn += 1;
  } else {
    usersTurn = 0;
  }
  //console.log(JSON.stringify(enabledTiles, null, 2));
  //console.log(`lastUser: ${lastUser} | usersTurn: ${usersTurn} | userId: ${userIds[usersTurn]}`);
  if (userIds.length >= usersTurn + 1 && usersTurn !== lastUser) {
    const turnUserId = userIds[usersTurn];
    users[turnUserId].isTurn = true;
    if (lastUser >= 0) {
      const lastUserId = userIds[lastUser];
      users[lastUserId].isTurn = false;
    }
    io.emit('turn', {
      userName: users[turnUserId]?.name, // Pass only the user's name
      usersTurn: usersTurn // Include the usersTurn variable
    });
    io.emit('users', Object.entries(users).map(([id, u]) => ({ clientId: id, ...u })));
  }
}

/* =========================
 * Server Startup
 * ========================= */

server.listen(3001, '0.0.0.0', () => {
  console.log('Carcacity server running on port 3001');
});

// Start the robot turn logic
robotTurn();