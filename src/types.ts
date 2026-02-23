import type { Context } from "grammy";
import type { SessionFlavor } from "grammy";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

export interface SessionData {
  phase: 1 | 2 | 3 | 4 | 5 | "complete";
  history: MessageParam[];
  lastActivity: number;
  awaitingConfirmation: boolean;
}

export type BotContext = Context & SessionFlavor<SessionData>;

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
  resume_texte: string;
}

