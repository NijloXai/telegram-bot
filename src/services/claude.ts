import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import {
  CLAUDE_MODEL,
  CLAUDE_MAX_TOKENS,
  MAX_HISTORY_MESSAGES,
} from "../config/constants.js";
import { SYSTEM_PROMPT } from "../config/prompts.js";
import logger from "../utils/logger.js";

const anthropic = new Anthropic();

export function chatStream(history: MessageParam[]) {
  const trimmed = history.slice(-MAX_HISTORY_MESSAGES);

  logger.debug({ messageCount: trimmed.length }, "Sending to Claude");

  return anthropic.messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: CLAUDE_MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: trimmed,
  });
}

