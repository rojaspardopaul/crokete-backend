const { getPrisma } = require("../prisma");

// Configuration
const MAX_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes

const attempts = () => getPrisma().loginAttempt;

/** La combinación email+ip es única en la tabla, lo que permite upsert atómico. */
const keyOf = (email, ip) => ({ email_ip: { email: String(email).toLowerCase(), ip } });

/**
 * Middleware to rate limit login attempts
 * Blocks user by email and IP after MAX_ATTEMPTS failed logins
 */
const loginRateLimiter = async (req, res, next) => {
  try {
    const { email } = req.body;
    const ip = req.ip || req.connection.remoteAddress || req.headers["x-forwarded-for"];

    if (!email) return next();

    const attempt = await attempts().findUnique({ where: keyOf(email, ip) });

    if (attempt && attempt.blockedUntil && attempt.blockedUntil > new Date()) {
      const remainingMinutes = Math.ceil((attempt.blockedUntil - new Date()) / 60000);
      return res.status(429).send({
        message: `Demasiados intentos fallidos de inicio de sesión. Cuenta temporalmente bloqueada. Por favor intenta de nuevo en ${remainingMinutes} minuto(s).`,
        blockedUntil: attempt.blockedUntil,
      });
    }

    if (attempt && attempt.attempts >= MAX_ATTEMPTS) {
      const blockedUntil = new Date(Date.now() + BLOCK_DURATION_MS);
      await attempts().update({
        where: { id: attempt.id },
        data: { blockedUntil, lastAttempt: new Date() },
      });

      return res.status(429).send({
        message: "Demasiados intentos fallidos de inicio de sesión. Cuenta bloqueada por 30 minutos.",
        blockedUntil,
      });
    }

    req.loginAttempt = attempt;
    next();
  } catch (error) {
    console.error("Error in loginRateLimiter:", error);
    // Si el limitador falla no se bloquea la petición.
    next();
  }
};

/**
 * Record a failed login attempt.
 *
 * Es un upsert atómico: dos intentos simultáneos desde la misma IP ya no pueden
 * pisarse el contador, que era el hueco del leer-incrementar-guardar anterior.
 */
const recordFailedAttempt = async (email, ip) => {
  try {
    const normalized = String(email).toLowerCase();
    const updated = await attempts().upsert({
      where: keyOf(normalized, ip),
      create: { email: normalized, ip, attempts: 1, lastAttempt: new Date() },
      update: { attempts: { increment: 1 }, lastAttempt: new Date() },
    });

    if (updated.attempts >= MAX_ATTEMPTS && !updated.blockedUntil) {
      await attempts().update({
        where: { id: updated.id },
        data: { blockedUntil: new Date(Date.now() + BLOCK_DURATION_MS) },
      });
    }
  } catch (error) {
    console.error("Error recording failed login attempt:", error);
  }
};

/**
 * Reset login attempts on successful login
 */
const resetLoginAttempts = async (email, ip) => {
  try {
    await attempts().deleteMany({ where: { email: String(email).toLowerCase(), ip } });
  } catch (error) {
    console.error("Error resetting login attempts:", error);
  }
};

module.exports = {
  loginRateLimiter,
  recordFailedAttempt,
  resetLoginAttempts,
};
