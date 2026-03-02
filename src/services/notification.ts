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

  // Emoji du score pour lecture rapide dans le groupe
  const scoreEmoji =
    data.score_qualification >= 4
      ? "\u{1F525}"
      : data.score_qualification >= 3
        ? "\u{1F7E1}"
        : "\u{1F534}";

  // Message en russe (resume toujours en russe comme defini dans le prompt Claude)
  const message = [
    `\u{1F4E9} Новый лид от Мира! ${scoreEmoji} ${data.score_qualification}/5`,
    "",
    `Имя: ${data.nom ?? "—"}`,
    `Компания: ${data.entreprise ?? "—"}`,
    `Тип проекта: ${data.type_projet ?? "—"}`,
    `Бюджет: ${data.budget ?? "—"}`,
    `Сроки: ${data.delais ?? "—"}`,
    `Email: ${data.email ?? "—"}`,
    `WhatsApp: ${data.whatsapp ?? "—"}`,
    "",
    `Описание: ${data.description ?? "—"}`,
    "",
    `Оценка: ${data.score_qualification}/5 ${scoreEmoji}`,
    `Резюме: ${data.resume_texte}`,
  ].join("\n");

  try {
    await api.sendMessage(Number(groupId), message);
  } catch (error) {
    logger.error({ error, groupId }, "Failed to notify team");
  }
}
