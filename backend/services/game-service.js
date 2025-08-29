/**
 * Game Service
 * Handles game flow, turns, scoring, and game state management
 */

const { gameState } = require('../models/game-state');
const boardService = require('./board-service');

/**
 * Handle tile click and update game state
 * @param {string} player - Player ID
 * @param {number} index - Player turn index
 * @param {boolean} enabled - Whether tile was enabled
 * @param {number} seq - Sequence number
 * @param {string} color - Player color
 * @param {number} row - Row position
 * @param {number} col - Column position
 * @param {object} io - Socket.IO instance for broadcasting
 */
function clickTile(player, index, enabled, seq, color, row, col, io) {
  // Place the tile
  gameState.board[row][col] = { 
    player: player, 
    index: index, 
    enabled: enabled, 
    sequence: seq, 
    color: color, 
    row: row, 
    col: col, 
    count: 0 
  };
  
  gameState.users[player].lastTile = [row, col];

  // Enable adjacent tiles
  boardService.enableIfValid(row + 1, col);
  boardService.enableIfValid(row - 1, col);
  boardService.enableIfValid(row, col + 1);
  boardService.enableIfValid(row, col - 1);
  
  // Update counts for diagonal tiles
  boardService.checkCount(row + 1, col + 1);
  boardService.checkCount(row + 1, col - 1);
  boardService.checkCount(row - 1, col + 1);
  boardService.checkCount(row - 1, col - 1);
  
  // Disable the clicked tile
  boardService.disableIfValid(row, col);

  gameState.sequence = seq + 1;
  toggleTurn(io);
  
  // Calculate scores
  const scores = boardService.largestConnectedGroups();
  const highestGroupSizes = {};
  
  scores.forEach(group => {
    const { player, count } = group;
    if (!highestGroupSizes[player] || count > highestGroupSizes[player]) {
      highestGroupSizes[player] = count;
    }
  });
  
  Object.keys(highestGroupSizes).forEach(playerId => {
    if (gameState.users[playerId]) {
      gameState.users[playerId].score = highestGroupSizes[playerId];
    }
  });
  
  io.emit('boardUpdate', gameState.board);
}

/**
 * Advance to the next user's turn and broadcast
 * @param {object} io - Socket.IO instance for broadcasting
 */
function toggleTurn(io) {
  const userIds = Object.keys(gameState.users);
  gameState.lastUser = gameState.usersTurn;
  
  // Check for game end condition
  if (gameState.enabledTiles.length === 0 && gameState.gameStarted) {
    if (gameState.lastUser >= 0) {
      const lastUserId = userIds[gameState.lastUser];
      gameState.users[lastUserId].isTurn = false;
    }
    
    gameState.checkMate = true;
    gameState.gameStarted = false;
    
    // Reset disconnected robots
    Object.keys(gameState.users).forEach(clientId => {
      const user = gameState.users[clientId];
      if (user.robot && !user.connected) {
        user.robot = false;
      }
    });

    io.emit('users', Object.entries(gameState.users).map(([id, u]) => ({ clientId: id, ...u })));
    io.emit('checkmate', gameState.checkMate);
    io.emit('gameStarted', gameState.gameStarted);
    return;
  }
  
  // Advance turn
  if (gameState.usersTurn < 0) {
    gameState.usersTurn = 0;
  } else if (gameState.usersTurn < userIds.length - 1) {
    gameState.usersTurn += 1;
  } else {
    gameState.usersTurn = 0;
  }
  
  const turnUserId = userIds[gameState.usersTurn];
  
  // Update tile ranks for current player
  gameState.enabledTiles.forEach(tile => {
    boardService.checkRank(tile.row, tile.col, turnUserId);
  });
  
  if (userIds.length >= gameState.usersTurn + 1 && gameState.usersTurn !== gameState.lastUser) {
    gameState.users[turnUserId].isTurn = true;
    
    if (gameState.lastUser >= 0) {
      const lastUserId = userIds[gameState.lastUser];
      gameState.users[lastUserId].isTurn = false;
    }

    io.emit('turn', {
      userName: gameState.users[turnUserId]?.name,
      usersTurn: gameState.usersTurn
    });
    io.emit('users', Object.entries(gameState.users).map(([id, u]) => ({ clientId: id, ...u })));
  }
}

/**
 * Start a new game
 * @param {object} io - Socket.IO instance for broadcasting
 */
function startGame(io) {
  boardService.clearBoard(io);
  gameState.gameStarted = true;
  gameState.checkMate = false;
  gameState.usersTurn = -1;
  gameState.lastUser = -1;
  
  // Move lobby users to game
  for (const [clientId, user] of Object.entries(gameState.users)) {
    if (user.page === 'lobby') {
      user.page = 'game';
      console.log(`${user.name} moved to the game page.`);
    }
  }

  // Enable initial tiles around center
  const middleIndex = (gameState.BOARD_SIZE - 1) / 2;
  boardService.enableIfValid(middleIndex + 1, middleIndex);
  boardService.enableIfValid(middleIndex - 1, middleIndex);
  boardService.enableIfValid(middleIndex, middleIndex + 1);
  boardService.enableIfValid(middleIndex, middleIndex - 1);

  toggleTurn(io);
  io.emit('boardUpdate', gameState.board);
  io.emit('gameStarted', gameState.gameStarted);
  io.emit('checkmate', gameState.checkMate);
}

/**
 * End the current game
 * @param {object} io - Socket.IO instance for broadcasting
 */
function endGame(io) {
  Object.keys(gameState.users).forEach(clientId => {
    gameState.users[clientId].page = "lobby";
  });

  io.emit('users', Object.entries(gameState.users).map(([id, u]) => ({ clientId: id, ...u })));
  boardService.clearBoard(io);
  gameState.gameStarted = false;
  gameState.checkMate = false;
  io.emit('checkmate', gameState.checkMate);
  io.emit('gameStarted', gameState.gameStarted);
  console.log('Game Ended.');
}

/**
 * Get current turn information
 * @param {object} io - Socket.IO instance for broadcasting
 */
function getCurrentTurn(io) {
  const userIds = Object.keys(gameState.users);
  if (gameState.usersTurn < 0 || gameState.usersTurn >= userIds.length) {
    io.emit('turn', {
      name: 'NA',
      usersTurn: gameState.usersTurn
    });
    return;
  }
  
  const currentUserId = userIds[gameState.usersTurn];
  io.emit('turn', {
    name: gameState.users[currentUserId]?.name,
    usersTurn: gameState.usersTurn
  });
}

module.exports = {
  clickTile,
  toggleTurn,
  startGame,
  endGame,
  getCurrentTurn
};