/**
 * Rate Limiting Middleware for Socket.IO
 * Prevents abuse by limiting requests per IP
 */

const config = require('./server-config');

// Store request counts per IP
const rateLimit = {};

/**
 * Rate limiting middleware for Socket.IO
 */
function rateLimitMiddleware(socket, next) {
  const ip = socket.handshake.address;

  if (!rateLimit[ip]) {
    rateLimit[ip] = { count: 0, timer: null };
  }

  rateLimit[ip].count++;

  if (rateLimit[ip].count > config.RATE_LIMIT_MAX_REQUESTS) {
    console.log(`Rate limit exceeded for IP: ${ip}`);
    return next(new Error('Rate limit exceeded. Please try again later.'));
  }

  // Reset the rate limit count after the window expires
  if (!rateLimit[ip].timer) {
    rateLimit[ip].timer = setTimeout(() => {
      delete rateLimit[ip];
    }, config.RATE_LIMIT_WINDOW_MS);
  }

  next();
}

module.exports = { rateLimitMiddleware };