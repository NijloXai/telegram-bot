/**
 * notification.ts — Notification de l'equipe dans le groupe Telegram prive.
 *
 * Envoie un message formate avec les donnees du prospect dans le groupe
 * defini par TELEGRAM_GROUP_ID. Si la variable n'est pas definie,
 * la notification est silencieusement ignoree (utile en dev local).
 */

import type { Api } from "grammy";
import type { ProspectResume } from "../types.js";
import logger from "../utils/logger.js";

export async function notifyTeam(
  api: Api,
  data: ProspectResume,
): Promise<void> {
  // Guard : permet de lancer le bot en dev sans configurer le groupe
  const groupId = process.env.TELEGRAM_GROUP_ID;
  if (!groupId) {
    logger.warn("TELEGRAM_GROUP_ID not set, skipping notification");
    return;
  }

  // Message en russe (resume toujours en russe comme defini dans le prompt Claude)
  const message = [
    "\u{1F4E9} Новый лид от Мира!",
    "",
    `Имя: ${data.nom ?? "—"}`,
    `Компания: ${data.entreprise ?? "—"}`,
    `Тип проекта: ${data.type_projet ?? "—"}`,
    `Сроки: ${data.delais ?? "—"}`,
    `Email: ${data.email ?? "—"}`,
    `WhatsApp: ${data.whatsapp ?? "—"}`,
    "",
    `Описание: ${data.description ?? "—"}`,
    "",
    `Резюме: ${data.resume_texte}`,
  ].join("\n");

  try {
    await api.sendMessage(Number(groupId), message);
  } catch (error) {
    logger.error({ error, groupId }, "Failed to notify team");
  }
}
