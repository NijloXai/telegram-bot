/**
 * validation.ts — Validation Zod des donnees prospect extraites de Claude.
 *
 * Definit le schema de validation pour le JSON que Claude insere
 * entre les balises PROSPECT_COMPLETE. Si le JSON est malformed ou
 * ne correspond pas au schema, la fonction retourne null et log l'erreur.
 *
 * Le schema correspond exactement a l'interface ProspectResume de types.ts.
 */

import { z } from "zod";
import type { ProspectResume } from "../types.js";
import { TYPE_PROJET_VALUES } from "../types.js";
import logger from "./logger.js";

export const prospectSchema = z.object({
  nom: z.string().nullable(),
  entreprise: z.string().nullable(),
  // Valeurs partagees avec types.ts pour garantir la coherence type TS <-> validation runtime
  type_projet: z.enum(TYPE_PROJET_VALUES).nullable(),
  description: z.string().nullable(),
  delais: z.string().nullable(),
  email: z.string().nullable(),
  whatsapp: z.string().nullable(),
  // Seul champ obligatoire (non-nullable) : Claude doit toujours fournir un resume
  resume_texte: z.string(),
});

// Validation en deux etapes : JSON.parse (syntaxe) puis safeParse Zod (structure/types)
export function extractProspectData(json: string): ProspectResume | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    logger.error({ json }, "Invalid JSON from Claude");
    return null;
  }

  const result = prospectSchema.safeParse(parsed);

  if (!result.success) {
    logger.error({ issues: result.error.issues }, "Prospect validation failed");
    return null;
  }

  return result.data;
}
