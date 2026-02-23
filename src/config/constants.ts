/**
 * constants.ts — Constantes metier du bot Mira.
 *
 * Centralise tous les parametres configurables :
 * modele Claude, limites de streaming, rate limiting, timeout d'inactivite,
 * et balises de detection de fin de conversation.
 */

// --- Claude AI ---
export const CLAUDE_MODEL = "claude-sonnet-4-6";
export const CLAUDE_MAX_TOKENS = 1024;
// L'historique est tronque aux N derniers messages avant envoi pour rester dans les limites de tokens
export const MAX_HISTORY_MESSAGES = 20;

// --- Streaming Telegram ---
// Le message est edite toutes les 500ms avec un curseur visuel pour simuler l'ecriture en direct
export const STREAM_EDIT_INTERVAL = 500;
export const STREAM_CURSOR = "...";

// --- Rate limiting ---
// Maximum 3 messages par fenetre de 10 secondes par utilisateur
export const RATE_LIMIT_MAX = 3;
export const RATE_LIMIT_WINDOW = 10_000;

// --- Timeout d'inactivite ---
// Si le prospect ne repond pas pendant 48h, la session est reset automatiquement a son retour
export const INACTIVITY_TIMEOUT = 48 * 60 * 60 * 1000;

// --- Detection de fin de conversation ---
// Claude insere ces balises autour du JSON prospect quand la conversation est terminee
// stream.ts les detecte pour extraire les donnees et les masquer au prospect
export const PROSPECT_COMPLETE_OPEN = "[PROSPECT_COMPLETE]";
export const PROSPECT_COMPLETE_CLOSE = "[/PROSPECT_COMPLETE]";
