/**
 * dm-only.ts — Middleware qui filtre les messages de groupe.
 *
 * Le bot ne repond qu'en message prive (DM). Tout message provenant
 * d'un groupe ou supergroupe est silencieusement ignore.
 * Place en premier dans la chaine pour eviter tout traitement inutile.
 */

import type { NextFunction } from "grammy";
import type { BotContext } from "../types.js";
import logger from "../utils/logger.js";

export async function dmOnly(ctx: BotContext, next: NextFunction): Promise<void> {
  if (ctx.chat?.type !== "private") {
    logger.debug({ chatType: ctx.chat?.type, chatId: ctx.chat?.id }, "Ignoring non-DM message");
    return;
  }

  await next();
}
