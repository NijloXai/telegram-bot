import type { Api } from "grammy";
import type { ProspectResume } from "../types.js";
import logger from "../utils/logger.js";

export async function notifyTeam(
  api: Api,
  data: ProspectResume,
): Promise<void> {
  const groupId = process.env.TELEGRAM_GROUP_ID;
  if (!groupId) {
    logger.warn("TELEGRAM_GROUP_ID not set, skipping notification");
    return;
  }

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
    await api.sendMessage(groupId, message);
  } catch (error) {
    logger.error({ error, groupId }, "Failed to notify team");
  }
}
