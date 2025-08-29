/**
 * Robot Service
 * Handles AI robot functionality and decision making
 */

const { gameState } = require('../models/game-state');
const config = require('../config/server-config');

/**
 * Simple sleep helper for async delays
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Determines the decision based on the difficulty level
 * @param {number} difficulty - The difficulty level of the robot (0 = easy, 1 = medium, 2 = hard, 3 = god mode)
 * @returns {string} The decision: "best", "middle", "worst", or "random"
 */
function makeDecision(difficulty) {
  const randomChance = Math.random();
  switch (difficulty) {
    case 3: // God mode
      return "best";
    case 2: // Hard difficulty
      if (randomChance < 0.7) return "best"; // 70% chance for the best move
      if (randomChance < 0.9) return "middle"; // 20% chance for a middle-ranked move
      if (randomChance < 0.95) return "random"; // 5% chance for a random move
      return "worst"; // 5% chance for a worst ranked
    case 1: // Medium difficulty
      if (randomChance < 0.05) return "best"; // 5% chance for the best move
      if (randomChance < 0.50) return "worst"; // 45% chance for a worst-ranked move
      if (randomChance < 0.65) return "middle"; // 15% chance for a middle-ranked move
      return "random"; // 35% chance for a random move
    case 0: // Easy difficulty
    default:
      return "random"; // Always make a random move
  }
}

/**
 * Robot turn logic - runs continuously to handle AI players
 * @param {Function} clickTile - Function to handle tile clicks
 * @param {object} io - Socket.IO instance for broadcasting
 */
async function robotTurn(clickTile,io) {
  while (true) {
    await sleep(gameState.ROBOT_SPEED);

    const userIds = Object.keys(gameState.users);
    if (gameState.usersTurn < 0 || gameState.usersTurn >= userIds.length) continue;

    const currentUserId = userIds[gameState.usersTurn];
    const currentUser = gameState.users[currentUserId];

    if (currentUser && currentUser.robot) {
      if (gameState.enabledTiles.length === 0) continue;

      // Sort tiles by rank
      const sortedTiles = [...gameState.enabledTiles].sort((a, b) => b.rank - a.rank);
      const highestRank = sortedTiles[0].rank;
      const lowestRank = sortedTiles[sortedTiles.length - 1].rank;

      // Categorize tiles
      const tilesWithHighestRank = sortedTiles.filter(tile => tile.rank === highestRank);
      const tilesWithMiddleRank = sortedTiles.filter(tile => 
        tile.rank > lowestRank && tile.rank < highestRank
      );
      const tilesWithLowestRank = sortedTiles.filter(tile => tile.rank === lowestRank);

      // Make decision based on difficulty
      const decision = makeDecision(currentUser.difficulty);

      let selectedTile;
      if (decision === "best" && tilesWithHighestRank.length > 0) {
        selectedTile = tilesWithHighestRank[Math.floor(Math.random() * tilesWithHighestRank.length)];
      } else if (decision === "middle" && tilesWithMiddleRank.length > 0) {
        selectedTile = tilesWithMiddleRank[Math.floor(Math.random() * tilesWithMiddleRank.length)];
      } else if (decision === "worst") {
        selectedTile = tilesWithLowestRank[Math.floor(Math.random() * tilesWithLowestRank.length)];
      } else if (decision === "random") {
        selectedTile = gameState.enabledTiles[Math.floor(Math.random() * gameState.enabledTiles.length)];
      } else {
        // Fallback in case of empty categories
        selectedTile = gameState.enabledTiles[Math.floor(Math.random() * gameState.enabledTiles.length)];
      }

      const { row, col, rank } = selectedTile;

      console.log(`Robot ${currentUser.name} clicks tile [${row}, ${col}]`);
      clickTile(currentUserId, gameState.usersTurn, false, gameState.sequence, currentUser.color, row, col,io);
    }
  }
}

module.exports = {
  sleep,
  makeDecision,
  robotTurn
};