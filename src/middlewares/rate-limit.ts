/**
 * rate-limit.ts — Middleware de limitation du debit par utilisateur.
 *
 * Empeche un utilisateur d'envoyer plus de 3 messages en 10 secondes.
 * Utilise une Map en memoire avec les timestamps des messages recents.
 * Un nettoyage periodique (toutes les 60s) supprime les entrees obsoletes
 * pour eviter les fuites de memoire.
 *
 * Note : la Map est en memoire (pas persistee). En cas de redemarrage du bot,
 * les compteurs sont remis a zero. Acceptable pour ce cas d'usage.
 */

import type { NextFunction } from "grammy";
import type { BotContext } from "../types.js";
import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW } from "../config/constants.js";
import logger from "../utils/logger.js";

// Cle = userId, valeur = tableau de timestamps des messages recents
const timestamps = new Map<number, number[]>();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60_000;

export async function rateLimit(ctx: BotContext, next: NextFunction): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  const now = Date.now();

  // Nettoyage "lazy" : declenche seulement quand un message arrive et que 60s se sont ecoulees
  // (pas via setInterval, pour eviter un timer global)
  if (now - lastCleanup > CLEANUP_INTERVAL) {
    for (const [id, ts] of timestamps) {
      const recent = ts.filter((t) => now - t < RATE_LIMIT_WINDOW);
      if (recent.length === 0) {
        timestamps.delete(id);
      } else {
        timestamps.set(id, recent);
      }
    }
    lastCleanup = now;
  }

  const userTimestamps = timestamps.get(userId) ?? [];

  // Fenetre glissante : ne garde que les timestamps des 10 dernieres secondes
  const recent = userTimestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);

  if (recent.length >= RATE_LIMIT_MAX) {
    logger.debug({ userId, count: recent.length }, "Rate limited");
    await ctx.reply("Пожалуйста, не так быстро! Подождите несколько секунд.");
    timestamps.set(userId, recent);
    return;
  }

  // Le timestamp courant est ajoute APRES la verification (compte pour les prochaines)
  recent.push(now);
  timestamps.set(userId, recent);

  await next();
}
