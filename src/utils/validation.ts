import { z } from "zod";
import type { ProspectResume } from "../types.js";
import { TYPE_PROJET_VALUES } from "../types.js";
import logger from "./logger.js";

export const prospectSchema = z.object({
  nom: z.string().nullable(),
  entreprise: z.string().nullable(),
  type_projet: z.enum(TYPE_PROJET_VALUES).nullable(),
  description: z.string().nullable(),
  delais: z.string().nullable(),
  email: z.string().nullable(),
  whatsapp: z.string().nullable(),
  resume_texte: z.string(),
});

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
