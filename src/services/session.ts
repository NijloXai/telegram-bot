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
        if (error.code !== "PGRST116") {
          logger.error({ error, key }, "Session read failed");
        }
        return undefined;
      }

      return data.value as SessionData;
    },

    async write(key, value) {
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
