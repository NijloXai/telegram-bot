/**
 * logger.ts — Instance pino partagee par tout le projet.
 *
 * En production : JSON (pour l'ingestion par Railway/services de logs).
 * En developpement : pino-pretty pour une sortie lisible dans le terminal.
 * Niveau debug en dev, info en prod.
 */

import pino from "pino";

const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  ...(process.env.NODE_ENV !== "production" && {
    transport: {
      target: "pino-pretty",
    },
  }),
});

export default logger;
