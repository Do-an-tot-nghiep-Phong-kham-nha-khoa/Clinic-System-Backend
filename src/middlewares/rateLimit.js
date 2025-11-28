// src/middlewares/rateLimit.js
const rateLimit = require('express-rate-limit');

module.exports.chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // max 10 requests per IP per minute (tune)
  message: { success: false, message: "Too many requests. Please try again later." }
});
