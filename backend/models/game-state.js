/**
 * Game State Management
 * Centralized state for users, board, and game variables
 */

const config = require('../config/server-config');

// Game state
const gameState = {
  // Users and spectators
  users: {},
  spectators: {},
  
  // Board state
  BOARD_SIZE: config.BOARD_SIZE_INIT,
  board: [],
  enabledTiles: [], // Array to track enabled tiles
  
  // Game flow state
  gameStarted: false,
  checkMate: false,
  sequence: 0,
  usersTurn: -1,
  lastUser: -1,
  
  // Robot state
  ROBOT_SPEED: config.INITIAL_ROBOT_SPEED,
  
  // Player colors (will be modified as colors are assigned)
  defaultColors: [...config.DEFAULT_COLORS]
};

/**
 * Initialize board with empty tiles
 */
function initializeBoard() {
  gameState.board = Array(gameState.BOARD_SIZE)
    .fill(null)
    .map(() =>
      Array(gameState.BOARD_SIZE)
        .fill(null)
        .map(() => ({ 
          player: null, 
          index: null, 
          enabled: false, 
          sequence: null, 
          rank: null 
        }))
    );
    
  gameState.enabledTiles = [];
  
  const middleIndex = (gameState.BOARD_SIZE - 1) / 2;
  gameState.board[middleIndex][middleIndex] = { player: 'board', index: -1 };
  gameState.sequence = 0;
  gameState.usersTurn = -1;
  gameState.gameStarted = false;
  gameState.checkMate = false;
}

/**
 * Reset game state for new game
 */
function resetGameState() {
  // Reset board
  initializeBoard();
  
  // Reset robot speed
  gameState.ROBOT_SPEED = config.INITIAL_ROBOT_SPEED;
  
  // Reset colors
  gameState.defaultColors = [...config.DEFAULT_COLORS];
}

/**
 * Get a color for a user
 */
function getColor(idx) {
  return gameState.defaultColors.shift();
}

/**
 * Return a color to the pool
 */
function returnColor(color) {
  if (color && !gameState.defaultColors.includes(color)) {
    gameState.defaultColors.push(color);
  }
}

// Initialize board on module load
initializeBoard();

module.exports = {
  gameState,
  initializeBoard,
  resetGameState,
  getColor,
  returnColor
};