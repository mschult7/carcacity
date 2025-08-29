/**
 * Server Configuration
 * Contains all server setup constants and configuration
 */

module.exports = {
  // Server settings
  PORT: 3001,
  HOST: '0.0.0.0',
  
  // Socket.IO settings
  SOCKET_PATH: '/cityapi',
  CORS_ORIGIN: 'https://panther01.ddns.net',
  
  // Rate limiting settings
  RATE_LIMIT_WINDOW_MS: 60000, // 1 minute
  RATE_LIMIT_MAX_REQUESTS: 100, // Max 100 requests per IP per minute
  
  // Game settings
  BOARD_SIZE_INIT: 9,
  INITIAL_ROBOT_SPEED: 1500,
  
  // Player settings
  MAX_PLAYERS: 5,
  DEFAULT_COLORS: ['#3b9774', '#ff9671', '#845ec2', '#FFDB58', '#3498db']
};