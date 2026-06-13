import pino from "pino";

/**
 * Structured JSON logger (Pino). In the SaaS this is the single logging
 * primitive; Cloud Run ingests the JSON lines directly. In development it
 * pretty-prints. Replaces ad-hoc console.log scattered across the legacy code.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  ...(process.env.NODE_ENV !== "production"
    ? { transport: { target: "pino-pretty", options: { colorize: true } } }
    : {}),
});

export type Logger = typeof logger;
