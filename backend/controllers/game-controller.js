/**
 * Game Controller
 * Handles game-related socket events: start, clickTile, endGame, etc.
 */

const { gameState } = require('../models/game-state');
const gameService = require('../services/game-service');
const boardService = require('../services/board-service');
const helpers = require('../utils/helpers');

/**
 * Handle game start
 * @param {object} socket - Socket instance
 * @param {object} io - Socket.IO instance
 */
function handleGameStart(socket, io) {
  const clientId = helpers.findUserBySocketId(gameState.users, socket.id);
  console.log(`User ${gameState.users[clientId].name} started the game.`);
  gameService.startGame(io);
}

/**
 * Handle tile click
 * @param {object} socket - Socket instance
 * @param {object} data - Click data containing row, col, player, index
 * @param {object} io - Socket.IO instance
 */
function handleTileClick(socket, data, io) {
  const { row, col, player, index } = data;
  const clientId = helpers.findUserBySocketId(gameState.users, socket.id);
  
  if (clientId) {
    gameService.clickTile(
      clientId, 
      index, 
      false, 
      gameState.sequence, 
      gameState.users[clientId].color, 
      row, 
      col, 
      io
    );
  }
}

/**
 * Handle game status request
 * @param {object} socket - Socket instance
 */
function handleGameStatus(socket) {
  socket.emit('gameStarted', gameState.gameStarted);
}

/**
 * Handle get turn request
 * @param {object} io - Socket.IO instance
 */
function handleGetTurn(io) {
  gameService.getCurrentTurn(io);
}

/**
 * Handle board request
 * @param {object} socket - Socket instance
 */
function handleGetBoard(socket) {
  socket.emit('boardUpdate', gameState.board);
}

/**
 * Handle board size request
 * @param {object} socket - Socket instance
 */
function handleGetBoardSize(socket) {
  socket.emit('boardSize', gameState.BOARD_SIZE);
}

/**
 * Handle set board size
 * @param {object} data - Size data
 * @param {object} io - Socket.IO instance
 */
function handleSetBoardSize(data, io) {
  const { size } = data;
  if (size && size >= 5 && size <= 15) {
    gameState.BOARD_SIZE = size;
    boardService.clearBoard(io);
    io.emit('boardSize', gameState.BOARD_SIZE);
    console.log(`Board size set to ${size}`);
  }
}

/**
 * Handle clear board request
 * @param {object} io - Socket.IO instance
 */
function handleClearBoard(io) {
  boardService.clearBoard(io);
}

/**
 * Handle end game request
 * @param {object} io - Socket.IO instance
 */
function handleEndGame(io) {
  gameService.endGame(io);
}

/**
 * Send initial board state on connect
 * @param {object} socket - Socket instance
 */
function sendInitialBoardState(socket) {
  socket.emit('boardUpdate', gameState.board);
}

module.exports = {
  handleGameStart,
  handleTileClick,
  handleGameStatus,
  handleGetTurn,
  handleGetBoard,
  handleGetBoardSize,
  handleSetBoardSize,
  handleClearBoard,
  handleEndGame,
  sendInitialBoardState
};