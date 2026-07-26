import pino from "pino";

/**
 * Structured JSON logger (Pino). Es la única primitiva de log de los módulos
 * nuevos: Railway ingiere las líneas JSON directamente. En desarrollo las
 * imprime legibles (vía pino-pretty, que por eso es sólo devDependency).
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  ...(process.env.NODE_ENV !== "production"
    ? { transport: { target: "pino-pretty", options: { colorize: true } } }
    : {}),
});

export type Logger = typeof logger;
