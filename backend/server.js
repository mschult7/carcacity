/**
 * Carcacity Game Server
 * 
 * Refactored for better organization and maintainability.
 * Separated concerns into logical modules while preserving exact functionality.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// Import configuration and middleware
const config = require('./config/server-config');
const { rateLimitMiddleware } = require('./config/rate-limiter');

// Import controllers
const userController = require('./controllers/user-controller');
const gameController = require('./controllers/game-controller');

// Import services
const gameService = require('./services/game-service');
const robotService = require('./services/robot-service');

// Import models
const { gameState } = require('./models/game-state');

/* =========================
 * Server and Socket Setup
 * ========================= */
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  path: config.SOCKET_PATH,
  cors: { origin: config.CORS_ORIGIN },
});

// Apply rate limiting middleware
io.use(rateLimitMiddleware);

/* =========================
 * Socket.IO Connection Handling
 * ========================= */
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  
  /* =========================
   * USER ACTIONS (join/leave, robots, presence, pages)
   * ========================= */

  // Register or update user (auto-named Player N)
  socket.on('player', ({ clientId }) => {
    userController.handlePlayerJoin(socket, clientId, io);
  });

  // Register or update user (custom name)
  socket.on('join', ({ name, clientId }) => {
    userController.handleUserJoin(socket, name, clientId, io);
  });

  // Create a robot player
  socket.on('robot', () => {
    userController.handleRobotCreation(io);
  });

  // Get user list
  socket.on('list', () => {
    userController.handleUserList(socket);
  });

  // Convert all users to robots
  socket.on('robotify', () => {
    userController.handleRobotifyAll(io);
  });

  // Update user's current page
  socket.on('updatePage', (page) => {
    userController.handlePageUpdate(socket, page, io);
  });

  // Remove a specific user (admin action)
  socket.on('remove', (user) => {
    userController.handleUserRemoval(user, io);
  });

  // User leaves voluntarily
  socket.on('leave', () => {
    userController.handleUserLeave(socket, io);
  });

  // Mark user as disconnected (do not delete; supports rejoin)
  socket.on('disconnect', () => {
    userController.handleUserDisconnect(socket, io);
  });

  // Clear all users and reset server state (admin action)
  socket.on('clearAll', () => {
    userController.handleClearAll(io);
  });

  /* =========================
   * GAME ACTIONS (game lifecycle, board, turn, tiles)
   * ========================= */

  // Start the game: move lobby users to game, enable initial tiles, set first turn
  socket.on('start', () => {
    gameController.handleGameStart(socket, io);
  });

  // Get game status
  socket.on('status', () => {
    gameController.handleGameStatus(socket);
  });

  // Handle tile click
  socket.on('clickTile', ({ row, col, player, index }) => {
    gameController.handleTileClick(socket, { row, col, player, index }, io);
  });

  // Get current board state
  socket.on('getBoard', () => {
    gameController.handleGetBoard(socket);
  });

  // Get board size
  socket.on('getBoardSize', () => {
    gameController.handleGetBoardSize(socket);
  });

  // Set board size
  socket.on('size', (data) => {
    gameController.handleSetBoardSize(data, io);
  });

  // Get current turn information
  socket.on('getTurn', () => {
    gameController.handleGetTurn(io);
  });

  // Reset the board only (keep players)
  socket.on('clearBoard', () => {
    gameController.handleClearBoard(io);
  });

  // End the game: return users to lobby and reset board/state
  socket.on('endGame', () => {
    gameController.handleEndGame(io);
  });

  // Send initial board state on connect
  gameController.sendInitialBoardState(socket);
});

/* =========================
 * Server Startup
 * ========================= */

server.listen(config.PORT, config.HOST, () => {
  console.log(`Carcacity server running on port ${config.PORT}`);
});

// Start the robot turn logic
robotService.robotTurn(gameService.clickTile);

module.exports = { app, server, io };