/**
 * claude.ts — Service d'interaction avec l'API Claude (Anthropic).
 *
 * Fournit chatStream() qui cree un flux (stream) de reponse Claude
 * a partir de l'historique de conversation. L'historique est tronque
 * aux 20 derniers messages avant envoi pour respecter les limites de tokens.
 *
 * Le client Anthropic lit automatiquement ANTHROPIC_API_KEY depuis process.env.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import {
  CLAUDE_MODEL,
  CLAUDE_MAX_TOKENS,
  MAX_HISTORY_MESSAGES,
} from "../config/constants.js";
import { SYSTEM_PROMPT } from "../config/prompts.js";
import logger from "../utils/logger.js";

// Le constructeur sans argument lit automatiquement la cle API depuis ANTHROPIC_API_KEY
const anthropic = new Anthropic();

export function chatStream(history: MessageParam[]) {
  // slice negatif : garde les N derniers messages (les plus recents)
  const trimmed = history.slice(-MAX_HISTORY_MESSAGES);

  logger.debug({ messageCount: trimmed.length }, "Sending to Claude");

  // Retourne un stream evenementiel (pas une Promise) consomme par stream.ts via l'evenement "text"
  return anthropic.messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: CLAUDE_MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: trimmed,
  });
}

