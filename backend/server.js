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
const BOARD_SIZE = 8;
let board = Array(BOARD_SIZE)
  .fill(null)
  .map(() =>
    Array(BOARD_SIZE).fill({ player: null, index: null })
  );

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Register or update user
  socket.on('join', ({ name, clientId }) => {
    if (!name || !clientId) return;

    users[clientId] = {
      clientId,
      name,
      socketId: socket.id,
      page: users[clientId]?.page || 'lobby',
      connected: true,
      robot: false,
    };

    console.log(`User joined/rejoined: ${name} (clientId ${clientId}, socket ${socket.id})`);
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
      board[row][col] = { player, index };
      // Broadcast updated board to all clients
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
          .map(() => ({ player: null, index: null })) // Initialize `index` as well
      );

    io.emit('boardUpdate', board);
    console.log('Board cleared');
  });

  // Send current board on new connection
  socket.emit('boardUpdate', board);
});

server.listen(3001, '0.0.0.0', () => {
  console.log('Socket.IO server running on port 3001');
});