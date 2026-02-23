/**
 * supabase.ts — Client Supabase et sauvegarde des prospects.
 *
 * Initialise le client Supabase avec la cle service_role (acces complet).
 * Fournit saveProspect() qui insere les donnees structurees d'un prospect
 * dans la table "prospects" et retourne l'ID genere.
 *
 * Le client est exporte pour etre reutilise par session.ts.
 */

import { createClient } from "@supabase/supabase-js";
import type { ProspectResume } from "../types.js";
import logger from "../utils/logger.js";

// Cle service_role (pas anon) : le bot a besoin d'un acces complet sans RLS
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function saveProspect(
  telegramId: number,
  data: ProspectResume,
): Promise<string | null> {
  const { data: prospect, error } = await supabase
    .from("prospects")
    .insert({
      telegram_id: telegramId,
      nom: data.nom,
      entreprise: data.entreprise,
      type_projet: data.type_projet,
      description: data.description,
      delais: data.delais,
      email: data.email,
      whatsapp: data.whatsapp,
      // Stocke l'objet ProspectResume complet en JSONB pour reference
      resume: data,
    })
    // Recupere l'UUID du prospect insere (utile pour le log)
    .select("id")
    .single();

  if (error) {
    logger.error({ error, telegramId }, "Failed to save prospect");
    return null;
  }

  return prospect.id as string;
}
