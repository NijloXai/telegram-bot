/**
 * start.ts — Handler de la commande /start.
 *
 * Gere deux scenarios :
 * 1. Nouveau /start : reinitialise la session et lance le premier message Claude
 * 2. /start mid-conversation : demande confirmation avant de reset
 *    (le prospect repond "da/yes" ou autre chose dans message.ts)
 *
 * Exporte aussi initialSession() utilise par cancel.ts et message.ts
 * pour reinitialiser l'etat de session.
 */

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

  // Si une conversation est en cours (historique non vide, pas terminee),
  // on demande confirmation plutot que de reset directement
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

  // Object.assign mute l'objet session en place (requis par Grammy, pas de remplacement)
  Object.assign(ctx.session, initialSession());
  // Claude a besoin d'au moins un message user pour repondre, on pousse "/start"
  ctx.session.history.push({ role: "user", content: "/start" });

  try {
    // Stream Claude -> affichage progressif dans Telegram -> sauvegarde reponse dans l'historique
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
