import type { BotContext } from "../types.js";

export async function handleHelp(ctx: BotContext): Promise<void> {
  const lines = [
    "Я — Мира, ассистентка команды Tsarag.",
    "",
    "Я помогу вам обсудить ваш проект и передам информацию нашей команде.",
    "",
    "/start — начать новый разговор",
    "/cancel — отменить текущий разговор",
    "/help — показать это сообщение",
  ];

  await ctx.reply(lines.join("\n"));
}
