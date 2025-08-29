/**
 * Board Service
 * Handles board operations, tile management, and validation
 */

const { gameState } = require('../models/game-state');

/**
 * Count tiles around a position for a specific player
 */
function countTiles(row, col, player) {
  let tiles = [];
  let count = 0;
  for (let r = row - 1; r <= row + 1; r++) {
    for (let c = col - 1; c <= col + 1; c++) {
      if (r >= 0 && r < gameState.BOARD_SIZE && c >= 0 && c < gameState.BOARD_SIZE) {
        if (gameState.board[r][c].player === player) {
          count++;
          tiles.push({ row: r, col: c });
        }
      }
    }
  }
  return count;
}

/**
 * Enable a tile if it's valid (within bounds and not occupied)
 */
function enableIfValid(r, c) {
  if (r >= 0 && r < gameState.BOARD_SIZE && c >= 0 && c < gameState.BOARD_SIZE) {
    if (gameState.board[r][c].sequence === null) {
      if (!gameState.board[r][c].enabled) {
        gameState.board[r][c].enabled = true;
        gameState.enabledTiles.push({ row: r, col: c, rank: null });
      }
    }
  }
}

/**
 * Disable a tile and remove it from enabled tiles
 */
function disableIfValid(r, c) {
  if (r >= 0 && r < gameState.BOARD_SIZE && c >= 0 && c < gameState.BOARD_SIZE) {
    if (gameState.board[r][c].enabled) {
      const index = gameState.enabledTiles.findIndex(tile => tile.row === r && tile.col === c);
      if (index !== -1) {
        gameState.enabledTiles.splice(index, 1);
      }
      if (gameState.board[r][c].sequence === null) {
        gameState.board[r][c].enabled = false;
      }
    }
  }
}

/**
 * Calculate and set rank for an enabled tile
 */
function checkRank(r, c, player) {
  if (r >= 0 && r < gameState.BOARD_SIZE && c >= 0 && c < gameState.BOARD_SIZE) {
    if (gameState.board[r][c].sequence === null || gameState.board[r][c].sequence < 0) {
      const rank = countTiles(r, c, player);
      const enabledTileIndex = gameState.enabledTiles.findIndex(tile => tile.row === r && tile.col === c);
      if (enabledTileIndex !== -1) {
        gameState.enabledTiles[enabledTileIndex].rank = rank;
      }
      gameState.board[r][c].rank = rank;
    }
  }
}

/**
 * Update count for a placed tile
 */
function checkCount(r, c) {
  if (r >= 0 && r < gameState.BOARD_SIZE && c >= 0 && c < gameState.BOARD_SIZE) {
    if (gameState.board[r][c].sequence >= 0 && !(gameState.board[r][c].sequence === null)) {
      gameState.board[r][c].count = countTiles(r, c, gameState.board[r][c].player);
    }
  }
}

/**
 * Check if a position is valid for DFS
 */
function isValid(row, col, player) {
  return (
    row >= 0 && row < gameState.BOARD_SIZE &&
    col >= 0 && col < gameState.BOARD_SIZE &&
    !visited[row][col] &&
    gameState.board[row][col].player === player
  );
}

/**
 * Depth-first search for connected tiles
 */
function dfs(row, col, player) {
  const stack = [[row, col]];
  const groupTiles = [];
  let count = 0;

  while (stack.length > 0) {
    const [currentRow, currentCol] = stack.pop();

    if (!isValid(currentRow, currentCol, player)) continue;
    visited[currentRow][currentCol] = true;
    groupTiles.push([currentRow, currentCol]);
    count++;

    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dx, dy] of directions) {
      const newRow = currentRow + dx;
      const newCol = currentCol + dy;
      stack.push([newRow, newCol]);
    }
  }

  return { count, tiles: groupTiles };
}

// Global visited array for DFS (will be reset for each use)
let visited = [];

/**
 * Find the largest connected groups on the board
 */
function largestConnectedGroups() {
  const rows = gameState.BOARD_SIZE;
  const cols = gameState.BOARD_SIZE;
  visited = Array.from({ length: rows }, () => Array(cols).fill(false));

  const directions = [
    [-1, 0], [1, 0], [0, -1], [0, 1]
  ];

  const allGroups = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const currentTile = gameState.board[row][col];
      if (!visited[row][col] && currentTile.player && currentTile.player !== 'board') {
        const groupData = dfs(row, col, currentTile.player);
        groupData.player = currentTile.player;
        allGroups.push(groupData);
      }
    }
  }

  return allGroups;
}

/**
 * Clear and reinitialize the board
 */
function clearBoard(io) {
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
  
  if (io) {
    io.emit('boardUpdate', gameState.board);
    io.emit('checkmate', gameState.checkMate);
    io.emit('gameStarted', gameState.gameStarted);
  }
  
  console.log('Board cleared');
}

module.exports = {
  countTiles,
  enableIfValid,
  disableIfValid,
  checkRank,
  checkCount,
  largestConnectedGroups,
  clearBoard
};