/**
 * Utility Helper Functions
 * Common utility functions used across the application
 */

/**
 * Generate a unique robot ID
 * @param {number} robotNumber - The robot number
 * @returns {string} Unique robot ID
 */
function generateRobotId(robotNumber) {
  return `robot_${robotNumber}_${Date.now()}`;
}

/**
 * Format user data for client emission
 * @param {object} users - Users object
 * @returns {array} Formatted user array
 */
function formatUsersForEmission(users) {
  return Object.entries(users).map(([id, u]) => ({ clientId: id, ...u }));
}

/**
 * Find user by socket ID
 * @param {object} users - Users object
 * @param {string} socketId - Socket ID to find
 * @returns {string|null} Client ID if found, null otherwise
 */
function findUserBySocketId(users, socketId) {
  return Object.keys(users).find(id => users[id].socketId === socketId) || null;
}

/**
 * Find available robot number
 * @param {object} users - Users object
 * @param {number} maxPlayers - Maximum number of players
 * @returns {number|null} Available robot number or null if none available
 */
function findAvailableRobotNumber(users, maxPlayers = 5) {
  const connectedUsers = Object.values(users).filter(u => u.connected);
  const connectedRobots = connectedUsers.filter(u => u.robot);
  
  let robotNumber = 1;
  while (connectedRobots.some(r => r.name === `Robot ${robotNumber}`) && robotNumber <= maxPlayers) {
    robotNumber++;
  }
  
  return robotNumber <= maxPlayers ? robotNumber : null;
}

/**
 * Check if user limit is reached
 * @param {object} users - Users object
 * @param {number} maxPlayers - Maximum number of players
 * @returns {boolean} True if limit is reached
 */
function isUserLimitReached(users, maxPlayers = 5) {
  const userIndex = Object.values(users).length;
  return userIndex >= maxPlayers;
}

module.exports = {
  generateRobotId,
  formatUsersForEmission,
  findUserBySocketId,
  findAvailableRobotNumber,
  isUserLimitReached
};