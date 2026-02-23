import { createClient } from "@supabase/supabase-js";
import type { ProspectResume } from "../types.js";
import logger from "../utils/logger.js";

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
      resume: data,
    })
    .select("id")
    .single();

  if (error) {
    logger.error({ error, telegramId }, "Failed to save prospect");
    return null;
  }

  return prospect.id as string;
}
