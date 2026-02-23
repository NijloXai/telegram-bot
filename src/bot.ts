import "dotenv/config";
import { Bot, session, webhookCallback } from "grammy";
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

// --- Bot instance ---
const bot = new Bot<BotContext>(process.env.TELEGRAM_BOT_TOKEN!);

// --- Middlewares (ordre : dmOnly -> session -> rateLimit) ---
bot.use(dmOnly);
bot.use(
  session<SessionData, BotContext>({
    initial: initialSession,
    storage: createSessionStorage(),
    getSessionKey: (ctx) => ctx.from?.id.toString(),
  })
);
bot.use(rateLimit);

// --- Commands ---
bot.command("start", handleStart);
bot.command("cancel", handleCancel);
bot.command("help", handleHelp);

// --- Messages (catch-all apres les commandes) ---
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
  await bot.api.setMyCommands([
    { command: "start", description: "Начать новый разговор" },
    { command: "cancel", description: "Отменить разговор" },
    { command: "help", description: "Помощь" },
  ]);

  if (process.env.NODE_ENV === "production") {
    const { createServer } = await import("node:http");
    const port = parseInt(process.env.PORT || "3000", 10);
    const handler = webhookCallback(bot, "http");

    const server = createServer(async (req, res) => {
      try {
        if (req.method === "POST") {
          await handler(req, res);
        } else {
          res.writeHead(200).end("OK");
        }
      } catch (error) {
        logger.error({ error }, "Webhook handler error");
        if (!res.headersSent) {
          res.writeHead(500).end();
        }
      }
    });

    server.listen(port, () => {
      logger.info({ port }, "Bot started in webhook mode");
    });
  } else {
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
