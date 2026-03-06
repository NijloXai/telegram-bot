/**
 * message.ts — Handler principal des messages (catch-all).
 *
 * Gere toute la logique conversationnelle dans cet ordre de priorite :
 * 1. Rejet des messages non-texte
 * 2. Reponse a une confirmation en attente (/start mid-conversation)
 * 3. Conversation terminee (phase "complete") -> inviter a /start
 * 4. Timeout 48h d'inactivite -> reset automatique + nouveau demarrage
 * 5. Auto-start (premier message sans /start) -> demarrage implicite
 * 6. Flux normal : ajout a l'historique -> Claude -> streaming -> detection prospect
 *
 * Si les balises PROSPECT_COMPLETE sont detectees dans la reponse Claude,
 * le JSON du prospect est extrait, valide, sauvegarde dans Supabase,
 * et l'equipe est notifiee dans le groupe Telegram.
 */

import type { BotContext } from "../types.js";
import { INACTIVITY_TIMEOUT } from "../config/constants.js";
import { chatStream } from "../services/claude.js";
import { saveProspect } from "../services/supabase.js";
import { notifyTeam } from "../services/notification.js";
import { streamToTelegram } from "../utils/stream.js";
import { extractProspectData } from "../utils/validation.js";
import { initialSession } from "./start.js";
import logger from "../utils/logger.js";

// Garde anti-doublon : empeche le traitement simultane du meme update
// (peut arriver si Telegram renvoie un update avant que le premier ne soit termine)
const processingUpdates = new Set<number>();

export async function handleMessage(ctx: BotContext): Promise<void> {
  const updateId = ctx.update.update_id;

  if (processingUpdates.has(updateId)) {
    logger.warn({ updateId }, "Duplicate update ignored");
    return;
  }
  processingUpdates.add(updateId);

  try {
    return await handleMessageInner(ctx);
  } finally {
    processingUpdates.delete(updateId);
  }
}

async function handleMessageInner(ctx: BotContext): Promise<void> {
  const userId = ctx.from?.id;
  const text = ctx.message?.text;

  if (!userId) return;

  // Rejet des messages non-texte (photos, stickers, etc.)
  if (!text) {
    await ctx.reply("Пожалуйста, отправьте текстовое сообщение.");
    return;
  }

  // --- Scenario 2 : Confirmation en attente (suite de /start mid-conversation) ---
  // start.ts a mis le flag awaitingConfirmation, ici on traite la reponse "da/yes" ou autre
  if (ctx.session.awaitingConfirmation) {
    ctx.session.awaitingConfirmation = false;
    const lower = text.toLowerCase().trim();

    if (lower === "да" || lower === "yes") {
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
        logger.error({ error, userId }, "Error in confirmation reset");
        await ctx.reply("Извините, произошла ошибка. Попробуйте ещё раз через несколько секунд.");
      }
      return;
    }

    await ctx.reply("Хорошо, продолжаем наш разговор.");
    return;
  }

  // --- Scenario 3 : Conversation terminee ---
  // Le prospect a deja ete sauvegarde, on redirige vers /start pour un nouveau projet
  if (ctx.session.phase === "complete") {
    await ctx.reply(
      "Спасибо! Наша команда свяжется с вами в ближайшее время. Напишите /start, чтобы обсудить новый проект.",
    );
    return;
  }

  // --- Scenario 4 : Timeout 48h ---
  // Detection passive : on verifie seulement quand le prospect revient, pas via un cron
  if (
    ctx.session.lastActivity > 0 &&
    Date.now() - ctx.session.lastActivity > INACTIVITY_TIMEOUT
  ) {
    logger.info({ userId }, "Session timed out after 48h");
    Object.assign(ctx.session, initialSession());
    ctx.session.history.push({ role: "user", content: "/start" });

    await ctx.reply("Давно не общались! Давайте начнём заново.");

    try {
      const stream = chatStream(ctx.session.history);
      const result = await streamToTelegram(ctx, stream);
      if (result.text) {
        ctx.session.history.push({ role: "assistant", content: result.text });
      }
      ctx.session.lastActivity = Date.now();
    } catch (error) {
      logger.error({ error, userId }, "Error in timeout restart");
      await ctx.reply("Извините, произошла ошибка. Попробуйте ещё раз через несколько секунд.");
    }
    return;
  }

  // --- Scenario 5 : Auto-start (premier message sans /start) ---
  // Si quelqu'un ecrit sans avoir fait /start, on simule un /start puis on traite son message
  // Cela genere deux appels Claude consecutifs (accueil + reponse au message reel)
  if (ctx.session.history.length === 0) {
    ctx.session.phase = 1;
    ctx.session.lastActivity = Date.now();
    ctx.session.history.push({ role: "user", content: "/start" });

    try {
      // Premier appel : message d'accueil de Mira
      const stream = chatStream(ctx.session.history);
      const result = await streamToTelegram(ctx, stream);
      if (result.text) {
        ctx.session.history.push({ role: "assistant", content: result.text });
      }

      // Second appel : reponse au message reel du prospect
      ctx.session.history.push({ role: "user", content: text });
      const stream2 = chatStream(ctx.session.history);
      const result2 = await streamToTelegram(ctx, stream2);
      if (result2.text) {
        ctx.session.history.push({ role: "assistant", content: result2.text });
      }
      ctx.session.lastActivity = Date.now();
    } catch (error) {
      logger.error({ error, userId }, "Error in auto-start");
      await ctx.reply("Извините, произошла ошибка. Попробуйте ещё раз через несколько секунд.");
    }
    return;
  }

  // --- Scenario 6 : Flux normal ---
  ctx.session.history.push({ role: "user", content: text });

  try {
    // Indicateur "typing..." pour l'UX, erreur ignoree car non critique
    try {
      await ctx.api.sendChatAction(ctx.chat!.id, "typing");
    } catch {
      // Ignore typing error
    }

    const stream = chatStream(ctx.session.history);
    const result = await streamToTelegram(ctx, stream);

    if (result.text) {
      ctx.session.history.push({ role: "assistant", content: result.text });
    }

    // Si les balises PROSPECT_COMPLETE sont presentes, on extrait et valide le JSON
    if (result.prospectJson) {
      const data = extractProspectData(result.prospectJson);

      if (data) {
        ctx.session.phase = "complete";

        // saveProspect et notifyTeam sont independants : execution en parallele
        const [prospectId] = await Promise.all([
          saveProspect(userId, data),
          notifyTeam(ctx.api, data),
        ]);

        logger.info({ userId, prospectId }, "Prospect saved and team notified");
      } else {
        logger.warn({ userId }, "Invalid prospect JSON from Claude");
      }
    }

    ctx.session.lastActivity = Date.now();
  } catch (error) {
    logger.error({ error, userId }, "Error in message handler");
    await ctx.reply("Извините, произошла ошибка. Попробуйте ещё раз через несколько секунд.");
  }
}
