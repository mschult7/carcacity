const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  path: '/cityapi',
  cors: { origin: '*' },
});

// Map clientId -> { name, socketId, page, connected }
const users = {};
const BOARD_SIZE = 21;
let gameStarted = false;
let sequence = 0;
let usersTurn = -1;
let lastUser = -1;
let board = Array(BOARD_SIZE)
  .fill(null)
  .map(() =>
    Array(BOARD_SIZE).fill({ player: null, index: null, enabled: false, sequence: null })
  );
let enabledTiles = []; // Array to track enabled tiles
clearBoard();

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Register or update user
  socket.on('join', ({ name, clientId }) => {
    if (!name || !clientId) return;

    // Determine join type
    let joinType = 'joining';
    if (users[clientId]) {
      // If user was previously disconnected, it's a rejoin
      joinType = users[clientId].connected === false ? 'rejoining' : 'joining';
    }

    users[clientId] = {
      clientId,
      name,
      socketId: socket.id,
      page: users[clientId]?.page || 'lobby',
      connected: true,
      robot: false,
      isTurn: false,
      lastTile: [],
    };

    console.log(`User ${joinType}: ${name} (clientId ${clientId}, socket ${socket.id})`);
    io.emit('users', Object.entries(users).map(([id, u]) => ({ clientId: id, ...u })));
  });

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

        users[robotId] = {
          clientId: robotId,
          name: `Robot ${robotNumber}`,
          socketId: null,
          page: 'lobby',
          connected: true,
          robot: true,
          isTurn: false,
          lastTile: [],
        };

        console.log(`Virtual robot added: Robot ${robotNumber} (clientId ${robotId})`);
        io.emit('users', Object.entries(users).map(([id, u]) => ({ clientId: id, ...u })));
      }
    }
  });

  socket.on('list', () => {
    io.emit('users', Object.values(users));
  });

  socket.on('start', () => {
    const clientId = Object.keys(users).find(id => users[id].socketId === socket.id);
    console.log(`User ${users[clientId].name} started the game.`);
    gameStarted = true;

    for (const [clientId, user] of Object.entries(users)) {
      if (user.robot && user.page === 'lobby') {
        user.page = 'game';
        console.log(`Robot ${user.name} moved to the game page.`);
      }
    }

    enableIfValid(11, 10);
    enableIfValid(9, 10);
    enableIfValid(10, 11);
    enableIfValid(10, 9);

    toggleTurn();

    io.emit('gameStarted', gameStarted);
  });

  socket.on('status', () => {
    io.emit('gameStarted', gameStarted);
  });

  socket.on('updatePage', (page) => {
    const clientId = Object.keys(users).find(id => users[id].socketId === socket.id);
    if (clientId) {
      users[clientId].page = page;
      io.emit('users', Object.entries(users).map(([id, u]) => ({ clientId: id, ...u })));
      console.log(`User ${users[clientId].name} updated page: ${page}`);
    }
  });

  socket.on('leave', () => {
    const clientId = Object.keys(users).find(id => users[id].socketId === socket.id);
    if (clientId) {
      console.log(`User left: ${users[clientId].name}`);
      for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          if (board[row][col].player === clientId) {
            board[row][col] = { player: null, index: null, sequence: board[row][col].sequence, enabled: board[row][col].enabled };
            disableIfValid(row + 1, col);
            disableIfValid(row - 1, col);
            disableIfValid(row, col + 1);
            disableIfValid(row, col - 1);
          }
        }
      }
      delete users[clientId];
    }
    io.emit('users', Object.values(users));
  });

  socket.on('disconnect', () => {
    const clientId = Object.keys(users).find(id => users[id].socketId === socket.id);
    if (clientId) {
      users[clientId].connected = false;
      console.log(`User disconnected: ${users[clientId].name}`);
      io.emit('users', Object.entries(users).map(([id, u]) => ({ clientId: id, ...u })));
    }
  });

  socket.on('clearAll', () => {
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

  socket.on('clickTile', ({ row, col, player, index }) => {
    if (!player) return;
    if (!board[row][col].player) {
      console.log(`Tile Clicked: [${row}, ${col}] ${player}`);
      board[row][col] = { player, index, enabled: false, sequence: sequence };
      sequence = sequence + 1;

      const userIds = Object.keys(users);
      if (usersTurn < 0 || usersTurn >= userIds.length) return;

      const currentUserId = userIds[usersTurn];
      users[currentUserId].lastTile = [row, col];

      enableIfValid(row + 1, col);
      enableIfValid(row - 1, col);
      enableIfValid(row, col + 1);
      enableIfValid(row, col - 1);
      disableIfValid(row, col);
      toggleTurn();
      io.emit('boardUpdate', board);
    }
  });

  socket.on('getBoard', () => {
    io.emit('boardUpdate', board);
  });
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

  socket.on('clearBoard', () => {
    clearBoard();
  });

  socket.emit('boardUpdate', board);
});

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function robotTurn() {
  setInterval(async () => {
    const userIds = Object.keys(users);
    if (usersTurn < 0 || usersTurn >= userIds.length) return;

    const currentUserId = userIds[usersTurn];
    const currentUser = users[currentUserId];

    if (currentUser && currentUser.robot) {
      if (lastUser >= 0 && lastUser < userIds.length) {
        const lastUserId = userIds[lastUser];
        const lastUserOB = users[lastUserId];
        if (!lastUserOB.robot) {
          await sleep(1500); // Add delay after humans
        }
      }
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
  }, 2000);
}

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

server.listen(3001, '0.0.0.0', () => {
  console.log('Socket.IO server running on port 3001');
});

// Start the robot turn logic
robotTurn();