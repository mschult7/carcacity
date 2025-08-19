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
const BOARD_SIZE = 9;
let sequence = 0;
let board = Array(BOARD_SIZE)
  .fill(null)
  .map(() =>
    Array(BOARD_SIZE).fill({ player: null, index: null, enabled: false, sequence: null })
  );

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
    };

    console.log(`User ${joinType}: ${name} (clientId ${clientId}, socket ${socket.id})`);
    // Also emit joinType to this user (and optionally to others)
    //socket.emit('joinType', joinType);

    io.emit('users', Object.entries(users).map(([id, u]) => ({ clientId: id, ...u })));
  });

  socket.on('robot', () => {
    // Count current connected users and robots
    const connectedUsers = Object.values(users).filter(u => u.connected);
    const connectedRobots = connectedUsers.filter(u => u.robot);

    if (connectedUsers.length < 5) {
      // Find next available robot number
      let robotNumber = 1;
      while (connectedRobots.some(r => r.name === `Robot ${robotNumber}`) && robotNumber <= 5) {
        robotNumber++;
      }

      if (robotNumber <= 5) {
        const robotId = `robot_${robotNumber}_${Date.now()}`;

        // Add robot as a virtual user (not tied to a real socket)
        users[robotId] = {
          clientId: robotId,
          name: `Robot ${robotNumber}`,
          socketId: null, // no real socket
          page: 'lobby',
          connected: true,
          robot: true,
        };

        console.log(`Virtual robot added: Robot ${robotNumber} (clientId ${robotId})`);
        io.emit('users', Object.entries(users).map(([id, u]) => ({ clientId: id, ...u })));
      }
    }
  });

  // Update page (lobby or game)
  socket.on('updatePage', (page) => {
    const clientId = Object.keys(users).find(id => users[id].socketId === socket.id);
    if (clientId) {
      users[clientId].page = page;
      io.emit('users', Object.entries(users).map(([id, u]) => ({ clientId: id, ...u })));
      console.log(`User ${users[clientId].name} updated page: ${page}`);
    }
  });

  // Send current users list
  socket.on('list', () => {
    socket.emit('users', Object.values(users));
  });

  // Remove a user
  socket.on('leave', () => {
    const clientId = Object.keys(users).find(id => users[id].socketId === socket.id);
    if (clientId) {
      console.log(`User left: ${users[clientId].name}`);
      // Clear board objects matching the clientId
      for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          if (board[row][col].player === clientId) {
            board[row][col] = { player: null, index: null, sequence: board[row][col].sequence, enabled: board[row][col].sequence };
          }
        }
      }
      delete users[clientId];
    }
    io.emit('users', Object.values(users));
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    const clientId = Object.keys(users).find(id => users[id].socketId === socket.id);
    if (clientId) {
      users[clientId].connected = false;
      console.log(`User disconnected: ${users[clientId].name}`);
      io.emit('users', Object.entries(users).map(([id, u]) => ({ clientId: id, ...u })));
    }
  });

  // Clear all users (for testing)
  socket.on('clearAll', () => {
    for (const sockId of Object.keys(io.sockets.sockets)) {
      const sock = io.sockets.sockets.get(sockId);
      if (sock) sock.disconnect(true);
    }

    for (const id in users) delete users[id];

    io.emit('users', []);
    console.log('All users cleared.');
  });

  socket.on('clickTile', ({ row, col, player, index }) => {
    // Only update if empty
    if (!board[row][col].player) {
      console.log(`Tile Clicked: [${row}, ${col}] ${player}`);
      board[row][col] = { player, index, enabled: false, sequence: sequence };
      // Broadcast updated board to all clients
      sequence = sequence + 1;
      // Helper to safely enable a tile if within bounds
    function enableIfValid(r, c) {
      if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
        board[r][c].enabled = true;
      }
    }

    // Enable adjacent tiles if within bounds
    enableIfValid(row + 1, col);
    enableIfValid(row - 1, col);
    enableIfValid(row + 1, col + 1);
    enableIfValid(row - 1, col + 1);
    enableIfValid(row + 1, col - 1);
    enableIfValid(row - 1, col - 1);
    enableIfValid(row, col + 1);
    enableIfValid(row, col - 1);

      io.emit('boardUpdate', board);
    }
  });

  socket.on('getBoard', () => {
    io.emit('boardUpdate', board);
  });

  socket.on('clearBoard', () => {
    board = Array(BOARD_SIZE)
      .fill(null)
      .map(() =>
        Array(BOARD_SIZE)
          .fill(null)
          .map(() => ({ player: null, index: null, enabled: false, sequence: null })) // Initialize `index` as well
      );
    board[4][4] = { player: 'board', index: -1 };
    io.emit('boardUpdate', board);
    console.log('Board cleared');
  });

  // Send current board on new connection
  socket.emit('boardUpdate', board);
});

server.listen(3001, '0.0.0.0', () => {
  console.log('Socket.IO server running on port 3001');
});