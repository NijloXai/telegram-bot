/**
 * stream.ts — Affichage en streaming des reponses Claude dans Telegram.
 *
 * Mecanisme :
 * 1. Envoie un message placeholder ("...") dans le chat
 * 2. Ecoute les chunks du stream Claude via l'evenement "text"
 * 3. Met a jour le message toutes les 500ms avec le texte accumule + curseur
 * 4. A la fin du stream, fait un dernier edit avec le texte final
 * 5. Si les balises PROSPECT_COMPLETE sont detectees, extrait le JSON
 *    et ne montre que le texte visible au prospect
 *
 * Le throttling a 500ms est necessaire car Telegram rate-limit les edits
 * de message a environ 1 par seconde par chat.
 */

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
  // Texte visible par le prospect (sans le bloc JSON)
  text: string;
  // JSON brut extrait entre les balises PROSPECT_COMPLETE, ou null si conversation pas terminee
  prospectJson: string | null;
}

export async function streamToTelegram(
  ctx: BotContext,
  stream: ReturnType<typeof chatStream>,
): Promise<StreamResult> {
  // Message placeholder cree immediatement pour avoir un message_id a editer ensuite
  const placeholder = await ctx.reply(STREAM_CURSOR);
  const chatId = placeholder.chat.id;
  const messageId = placeholder.message_id;

  let lastSnapshot = "";    // Dernier texte complet recu du stream
  let lastEditTime = 0;     // Timestamp du dernier edit envoye a Telegram
  let editTimer: ReturnType<typeof setTimeout> | null = null; // Timer pour l'edit differe

  const editMessage = async (text: string) => {
    try {
      await ctx.api.editMessageText(chatId, messageId, text);
    } catch {
      // "message is not modified" ou autre erreur Telegram — on ignore
    }
  };

  // Masque le bloc JSON au prospect : coupe le texte avant la balise d'ouverture
  const getVisibleText = (text: string): string => {
    const openIdx = text.indexOf(PROSPECT_COMPLETE_OPEN);
    if (openIdx !== -1) {
      return text.slice(0, openIdx).trim();
    }
    return text;
  };

  // Throttling hybride (throttle + debounce) :
  // - Si >= 500ms depuis le dernier edit -> edit immediat
  // - Sinon, on programme un edit differe pour completer les 500ms
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

  // Attend la fin complete du stream Claude
  let fullText: string;
  try {
    fullText = await stream.finalText();
  } catch (error) {
    // Liberer le timer AVANT d'editer le message d'erreur pour eviter qu'il ecrase le message
    if (editTimer) clearTimeout(editTimer);
    logger.error({ error }, "Claude stream error");
    await editMessage("Извините, произошла ошибка. Попробуйте ещё раз.");
    return { text: "", prospectJson: null };
  }

  if (editTimer) clearTimeout(editTimer);

  // Extraction du JSON prospect si les balises sont presentes dans la reponse
  let prospectJson: string | null = null;
  let visibleText = fullText;

  const openIdx = fullText.indexOf(PROSPECT_COMPLETE_OPEN);
  const closeIdx = fullText.indexOf(PROSPECT_COMPLETE_CLOSE);

  if (openIdx !== -1 && closeIdx !== -1) {
    prospectJson = fullText
      .slice(openIdx + PROSPECT_COMPLETE_OPEN.length, closeIdx)
      .trim();
    // Texte visible = tout sauf le bloc JSON (avant la balise + apres la balise fermante)
    visibleText = (
      fullText.slice(0, openIdx) +
      fullText.slice(closeIdx + PROSPECT_COMPLETE_CLOSE.length)
    ).trim();
  }

  // Fallback : si visibleText est vide apres trim, on affiche le texte complet
  await editMessage(visibleText || fullText);

  return { text: visibleText, prospectJson };
}
