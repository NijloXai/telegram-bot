import type { BotContext } from "../types.js";
import type { chatStream } from "../services/claude.js";
import {
  STREAM_EDIT_INTERVAL,
  STREAM_CURSOR,
  PROSPECT_COMPLETE_OPEN,
  PROSPECT_COMPLETE_CLOSE,
} from "../config/constants.js";
import logger from "./logger.js";

export interface StreamResult {
  text: string;
  prospectJson: string | null;
}

export async function streamToTelegram(
  ctx: BotContext,
  stream: ReturnType<typeof chatStream>,
): Promise<StreamResult> {
  const placeholder = await ctx.reply(STREAM_CURSOR);
  const chatId = placeholder.chat.id;
  const messageId = placeholder.message_id;

  let lastSnapshot = "";
  let lastEditTime = 0;
  let editTimer: ReturnType<typeof setTimeout> | null = null;

  const editMessage = async (text: string) => {
    try {
      await ctx.api.editMessageText(chatId, messageId, text);
    } catch {
      // "message is not modified" or other Telegram error — ignore
    }
  };

  const getVisibleText = (text: string): string => {
    const openIdx = text.indexOf(PROSPECT_COMPLETE_OPEN);
    if (openIdx !== -1) {
      return text.slice(0, openIdx).trim();
    }
    return text;
  };

  stream.on("text", (_delta, snapshot) => {
    lastSnapshot = snapshot;
    const now = Date.now();
    const visible = getVisibleText(snapshot);

    if (now - lastEditTime >= STREAM_EDIT_INTERVAL) {
      lastEditTime = now;
      if (editTimer) clearTimeout(editTimer);
      void editMessage(visible + STREAM_CURSOR);
    } else if (!editTimer) {
      editTimer = setTimeout(() => {
        editTimer = null;
        lastEditTime = Date.now();
        void editMessage(getVisibleText(lastSnapshot) + STREAM_CURSOR);
      }, STREAM_EDIT_INTERVAL - (now - lastEditTime));
    }
  });

  let fullText: string;
  try {
    fullText = await stream.finalText();
  } catch (error) {
    logger.error({ error }, "Claude stream error");
    await editMessage("Извините, произошла ошибка. Попробуйте ещё раз.");
    return { text: "", prospectJson: null };
  }

  if (editTimer) clearTimeout(editTimer);

  let prospectJson: string | null = null;
  let visibleText = fullText;

  const openIdx = fullText.indexOf(PROSPECT_COMPLETE_OPEN);
  const closeIdx = fullText.indexOf(PROSPECT_COMPLETE_CLOSE);

  if (openIdx !== -1 && closeIdx !== -1) {
    prospectJson = fullText
      .slice(openIdx + PROSPECT_COMPLETE_OPEN.length, closeIdx)
      .trim();
    visibleText = (
      fullText.slice(0, openIdx) +
      fullText.slice(closeIdx + PROSPECT_COMPLETE_CLOSE.length)
    ).trim();
  }

  await editMessage(visibleText || fullText);

  return { text: visibleText, prospectJson };
}
