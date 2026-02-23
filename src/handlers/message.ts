import type { BotContext } from "../types.js";
import { INACTIVITY_TIMEOUT } from "../config/constants.js";
import { chatStream } from "../services/claude.js";
import { saveProspect } from "../services/supabase.js";
import { notifyTeam } from "../services/notification.js";
import { streamToTelegram } from "../utils/stream.js";
import { extractProspectData } from "../utils/validation.js";
import { initialSession } from "./start.js";
import logger from "../utils/logger.js";

export async function handleMessage(ctx: BotContext): Promise<void> {
  const userId = ctx.from?.id;
  const text = ctx.message?.text;

  if (!userId) return;

  if (!text) {
    await ctx.reply("Пожалуйста, отправьте текстовое сообщение.");
    return;
  }

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

  if (ctx.session.phase === "complete") {
    await ctx.reply(
      "Спасибо! Наша команда свяжется с вами в ближайшее время. Напишите /start, чтобы обсудить новый проект.",
    );
    return;
  }

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

  if (ctx.session.history.length === 0) {
    ctx.session.phase = 1;
    ctx.session.lastActivity = Date.now();
    ctx.session.history.push({ role: "user", content: "/start" });

    try {
      const stream = chatStream(ctx.session.history);
      const result = await streamToTelegram(ctx, stream);
      if (result.text) {
        ctx.session.history.push({ role: "assistant", content: result.text });
      }

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

  ctx.session.history.push({ role: "user", content: text });

  try {
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

    if (result.prospectJson) {
      const data = extractProspectData(result.prospectJson);

      if (data) {
        ctx.session.phase = "complete";

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
