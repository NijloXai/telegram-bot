/**
 * cancel.ts — Handler de la commande /cancel.
 *
 * Reinitialise la session sans confirmation et invite le prospect
 * a utiliser /start pour recommencer. Simple et sans condition.
 */

import type { BotContext } from "../types.js";
import { initialSession } from "./start.js";
import logger from "../utils/logger.js";

export async function handleCancel(ctx: BotContext): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  logger.info({ userId }, "/cancel command");

  // Object.assign mute l'objet session en place (requis par Grammy, pas de remplacement)
  Object.assign(ctx.session, initialSession());
  await ctx.reply("Разговор отменён. Напишите /start, чтобы начать заново.");
}
