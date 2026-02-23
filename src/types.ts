/**
 * types.ts — Definitions de types centrales du bot Mira.
 *
 * Contient les types partages entre tous les modules :
 * - SessionData : etat de la conversation persistee dans Supabase
 * - BotContext : type enrichi de Grammy avec les sessions
 * - TypeProjet : categories de projets web que Claude attribue
 * - ProspectResume : donnees structurees extraites en fin de conversation
 */

import type { Context } from "grammy";
import type { SessionFlavor } from "grammy";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

export interface SessionData {
  // Phase de la conversation (1-5 = collecte d'infos, "complete" = prospect sauvegarde)
  phase: 1 | 2 | 3 | 4 | 5 | "complete";
  // Historique au format Claude MessageParam, envoye tel quel a l'API
  history: MessageParam[];
  // Timestamp du dernier message, utilise pour detecter le timeout de 48h
  lastActivity: number;
  // True quand le prospect a fait /start en pleine conversation et qu'on attend sa confirmation
  awaitingConfirmation: boolean;
}

// SessionFlavor injecte ctx.session (type SessionData) dans le contexte Grammy
export type BotContext = Context & SessionFlavor<SessionData>;

// Categories de projets utilisees par le schema Zod ET par le prompt Claude
export const TYPE_PROJET_VALUES = [
  "site_vitrine",
  "ecommerce",
  "application_web",
  "application_mobile",
  "landing_page",
  "refonte",
  "autre",
] as const;

export type TypeProjet = (typeof TYPE_PROJET_VALUES)[number];

export interface ProspectResume {
  nom: string | null;
  entreprise: string | null;
  type_projet: TypeProjet | null;
  description: string | null;
  delais: string | null;
  email: string | null;
  whatsapp: string | null;
  // Toujours en russe, quelle que soit la langue de la conversation
  resume_texte: string;
}

