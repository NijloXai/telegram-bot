import type { BotContext, SessionData } from "../types.js";
import { chatStream } from "../services/claude.js";
import { streamToTelegram } from "../utils/stream.js";
import logger from "../utils/logger.js";

export function initialSession(): SessionData {
  return {
    phase: 1,
    history: [],
    lastActivity: Date.now(),
    awaitingConfirmation: false,
  };
}

export async function handleStart(ctx: BotContext): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  logger.info({ userId }, "/start command");

  if (
    ctx.session.history.length > 0 &&
    ctx.session.phase !== "complete"
  ) {
    ctx.session.awaitingConfirmation = true;
    await ctx.reply(
      "У вас уже есть активный разговор. Вы уверены, что хотите начать заново? (да/нет)",
    );
    return;
  }

  Object.assign(ctx.session, initialSession());
  ctx.session.history.push({ role: "user", content: "/start" });

  try {
    const stream = chatStream(ctx.session.history);
    const result = await streamToTelegram(ctx, stream);

    if (result.text) {
      ctx.session.history.push({ role: "assistant", content: result.text });
    }

    ctx.session.lastActivity = Date.now();
  } catch (error) {
    logger.error({ error, userId }, "Error in /start handler");
    await ctx.reply("Извините, произошла ошибка. Попробуйте ещё раз через несколько секунд.");
  }
}
