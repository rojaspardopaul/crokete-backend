const LoginAttempt = require("../../models/LoginAttempt");

// Configuration
const MAX_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Middleware to rate limit login attempts
 * Blocks user by email and IP after MAX_ATTEMPTS failed logins
 */
const loginRateLimiter = async (req, res, next) => {
  try {
    const { email } = req.body;
    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];

    if (!email) {
      return next();
    }

    // Find existing login attempt record
    const attempt = await LoginAttempt.findOne({ email: email.toLowerCase(), ip });

    // Check if currently blocked
    if (attempt && attempt.blockedUntil && attempt.blockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((attempt.blockedUntil - new Date()) / 60000);
      return res.status(429).send({
        message: `Demasiados intentos fallidos de inicio de sesión. Cuenta temporalmente bloqueada. Por favor intenta de nuevo en ${remainingMinutes} minuto(s).`,
        blockedUntil: attempt.blockedUntil,
      });
    }

    // Check if exceeded max attempts
    if (attempt && attempt.attempts >= MAX_ATTEMPTS) {
      // Block the account
      const blockedUntil = new Date(Date.now() + BLOCK_DURATION_MS);
      attempt.blockedUntil = blockedUntil;
      attempt.lastAttempt = new Date();
      await attempt.save();

      return res.status(429).send({
        message: `Demasiados intentos fallidos de inicio de sesión. Cuenta bloqueada por 30 minutos.`,
        blockedUntil,
      });
    }

    // Attach attempt info to request for use in login controller
    req.loginAttempt = attempt;
    next();
  } catch (error) {
    console.error("Error in loginRateLimiter:", error);
    // Don't block the request if rate limiter fails
    next();
  }
};

/**
 * Record a failed login attempt
 * Call this from the login controller when authentication fails
 */
const recordFailedAttempt = async (email, ip) => {
  try {
    const attempt = await LoginAttempt.findOne({ email: email.toLowerCase(), ip });

    if (attempt) {
      // Increment attempts
      attempt.attempts += 1;
      attempt.lastAttempt = new Date();
      
      // Block if reached max attempts
      if (attempt.attempts >= MAX_ATTEMPTS) {
        attempt.blockedUntil = new Date(Date.now() + BLOCK_DURATION_MS);
      }
      
      await attempt.save();
    } else {
      // Create new attempt record
      await LoginAttempt.create({
        email: email.toLowerCase(),
        ip,
        attempts: 1,
        lastAttempt: new Date(),
      });
    }
  } catch (error) {
    console.error("Error recording failed login attempt:", error);
  }
};

/**
 * Reset login attempts on successful login
 * Call this from the login controller when authentication succeeds
 */
const resetLoginAttempts = async (email, ip) => {
  try {
    await LoginAttempt.deleteOne({ email: email.toLowerCase(), ip });
  } catch (error) {
    console.error("Error resetting login attempts:", error);
  }
};

module.exports = {
  loginRateLimiter,
  recordFailedAttempt,
  resetLoginAttempts,
};
