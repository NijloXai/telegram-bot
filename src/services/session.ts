/**
 * session.ts — Adaptateur de stockage de session Grammy pour Supabase.
 *
 * Implemente l'interface StorageAdapter de Grammy pour persister les sessions
 * dans la table "sessions" de Supabase au lieu de la memoire.
 * Chaque session est identifiee par l'ID Telegram de l'utilisateur.
 *
 * Operations : read (SELECT), write (UPSERT), delete (DELETE).
 */

import type { StorageAdapter } from "grammy";
import type { SessionData } from "../types.js";
import { supabase } from "./supabase.js";
import logger from "../utils/logger.js";

export function createSessionStorage(): StorageAdapter<SessionData> {
  return {
    async read(key) {
      const { data, error } = await supabase
        .from("sessions")
        .select("value")
        .eq("key", key)
        .single();

      if (error) {
        // PGRST116 = "Row not found" de PostgREST, normal pour un nouvel utilisateur
        if (error.code !== "PGRST116") {
          logger.error({ error, key }, "Session read failed");
        }
        return undefined;
      }

      return data.value as SessionData;
    },

    async write(key, value) {
      // Upsert : cree la session si elle n'existe pas, ou la met a jour sinon
      const { error } = await supabase
        .from("sessions")
        .upsert({ key, value }, { onConflict: "key" });

      if (error) {
        logger.error({ error, key }, "Session write failed");
      }
    },

    async delete(key) {
      const { error } = await supabase
        .from("sessions")
        .delete()
        .eq("key", key);

      if (error) {
        logger.error({ error, key }, "Session delete failed");
      }
    },
  };
}
