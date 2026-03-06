/**
 * bot.ts — Point d'entree du bot Mira.
 *
 * Responsabilites :
 * - Validation des variables d'environnement au demarrage
 * - Configuration de la chaine de middlewares (dmOnly -> session -> rateLimit)
 * - Enregistrement des commandes (/start, /cancel, /help)
 * - Handler catch-all pour les messages texte
 * - Demarrage en mode webhook (production/Railway) ou polling (local)
 * - Arret gracieux sur SIGINT/SIGTERM
 */

import "dotenv/config";
import { Bot, session } from "grammy";
import type { BotContext, SessionData } from "./types.js";
import { createSessionStorage } from "./services/session.js";
import { initialSession, handleStart } from "./handlers/start.js";
import { handleCancel } from "./handlers/cancel.js";
import { handleHelp } from "./handlers/help.js";
import { handleMessage } from "./handlers/message.js";
import { dmOnly } from "./middlewares/dm-only.js";
import { rateLimit } from "./middlewares/rate-limit.js";
import logger from "./utils/logger.js";

// --- Validation env ---
const requiredEnvVars = [
  "TELEGRAM_BOT_TOKEN",
  "ANTHROPIC_API_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_KEY",
] as const;

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    logger.fatal(`Missing required env var: ${envVar}`);
    process.exit(1);
  }
}

if (process.env.TELEGRAM_GROUP_ID && isNaN(Number(process.env.TELEGRAM_GROUP_ID))) {
  logger.fatal("TELEGRAM_GROUP_ID must be a valid number");
  process.exit(1);
}

// --- Bot instance ---
const bot = new Bot<BotContext>(process.env.TELEGRAM_BOT_TOKEN!);

// --- Middlewares ---
// Ordre critique :
// 1. dmOnly filtre les groupes AVANT que la session ne soit chargee (evite des lectures Supabase inutiles)
// 2. session charge/sauvegarde l'etat de conversation depuis Supabase
// 3. rateLimit est APRES session car il a besoin de ctx.from
bot.use(dmOnly);
bot.use(
  session<SessionData, BotContext>({
    initial: initialSession,
    storage: createSessionStorage(),
    // Cle de session = ID Telegram de l'utilisateur (chaque utilisateur a sa propre session)
    getSessionKey: (ctx) => ctx.from?.id.toString(),
  })
);
bot.use(rateLimit);

// --- Commands ---
bot.command("start", handleStart);
bot.command("cancel", handleCancel);
bot.command("help", handleHelp);

// --- Messages ---
// Catch-all : recoit tout message qui n'est pas une commande
bot.on("message", handleMessage);

// --- Error handler ---
bot.catch((err) => {
  logger.error(
    { error: err.error, updateId: err.ctx.update.update_id },
    "Unhandled bot error"
  );
});

// --- Start ---
async function start() {
  // Definit les commandes visibles dans le menu du bot Telegram (en russe)
  await bot.api.setMyCommands([
    { command: "start", description: "Начать новый разговор" },
    { command: "cancel", description: "Отменить разговор" },
    { command: "help", description: "Помощь" },
  ]);

  if (process.env.NODE_ENV === "production") {
    // Production (Railway) : serveur HTTP qui recoit les webhooks de Telegram
    const { createServer } = await import("node:http");
    const port = parseInt(process.env.PORT || "3000", 10);

    // On ne passe PAS par webhookCallback car il attend la fin du traitement
    // avant de repondre a Telegram. Si le traitement (streaming Claude) prend
    // trop longtemps, Telegram renvoie le meme update -> double traitement.
    // A la place, on repond 200 immediatement et on traite en arriere-plan.
    const server = createServer(async (req, res) => {
      if (req.method === "POST") {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const body = Buffer.concat(chunks).toString();

        // Repondre 200 immediatement pour eviter les retries Telegram
        res.writeHead(200).end();

        try {
          const update = JSON.parse(body);
          await bot.handleUpdate(update);
        } catch (error) {
          logger.error({ error }, "Error processing webhook update");
        }
      } else {
        res.writeHead(200).end("OK");
      }
    });

    server.listen(port, () => {
      logger.info({ port }, "Bot started in webhook mode");
    });
  } else {
    // Dev local : polling (pas besoin de configurer un webhook)
    await bot.start({
      onStart: (botInfo) => {
        logger.info(
          { username: botInfo.username },
          "Bot started in polling mode"
        );
      },
    });
  }
}

// --- Graceful shutdown ---
async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  await bot.stop();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start().catch((error) => {
  logger.fatal({ error }, "Failed to start bot");
  process.exit(1);
});
