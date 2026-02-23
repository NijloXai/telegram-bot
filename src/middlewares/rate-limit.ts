import type { NextFunction } from "grammy";
import type { BotContext } from "../types.js";
import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW } from "../config/constants.js";
import logger from "../utils/logger.js";

const timestamps = new Map<number, number[]>();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60_000;

export async function rateLimit(ctx: BotContext, next: NextFunction): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const now = Date.now();

  if (now - lastCleanup > CLEANUP_INTERVAL) {
    for (const [id, ts] of timestamps) {
      const recent = ts.filter((t) => now - t < RATE_LIMIT_WINDOW);
      if (recent.length === 0) {
        timestamps.delete(id);
      } else {
        timestamps.set(id, recent);
      }
    }
    lastCleanup = now;
  }

  const userTimestamps = timestamps.get(userId) ?? [];

  const recent = userTimestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);

  if (recent.length >= RATE_LIMIT_MAX) {
    logger.debug({ userId, count: recent.length }, "Rate limited");
    await ctx.reply("Пожалуйста, не так быстро! Подождите несколько секунд.");
    timestamps.set(userId, recent);
    return;
  }

  recent.push(now);
  timestamps.set(userId, recent);

  await next();
}
