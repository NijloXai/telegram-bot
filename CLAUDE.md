# Mira — Bot Telegram IA pour Tsarag

## Projet

Bot Telegram nomme **Mira**, assistant virtuel de l'equipe **Tsarag** (developpeurs web).
Mira receptionne les prospects venant d'Instagram (50k+ abonnes), guide la conversation en 5 phases via Claude AI, sauvegarde dans Supabase, et notifie l'equipe dans un groupe Telegram prive.

## Stack technique

- **Runtime** : Node.js + TypeScript (strict)
- **Bot Telegram** : Grammy (`grammy` + session adapter custom Supabase)
- **IA** : Claude API (`claude-sonnet-4-6` via `@anthropic-ai/sdk`) — streaming actif
- **Base de donnees** : Supabase (PostgreSQL) — tables `prospects` et `sessions`
- **Validation** : Zod
- **Logger** : pino (pino-pretty en dev, JSON en prod)
- **Tests** : vitest
- **Package manager** : npm
- **Deploiement** : Railway (webhook en prod, polling en local)

## Architecture

```
src/
├── bot.ts              <- Point d'entree
├── config/
│   ├── prompts.ts      <- System prompt Claude
│   └── constants.ts    <- Constantes (limites, timeouts, modele)
├── handlers/
│   ├── start.ts        <- /start (confirmation si actif, reset, accueil russe)
│   ├── cancel.ts       <- /cancel
│   ├── help.ts         <- /help
│   └── message.ts      <- Logique principale (non-texte, timeout, stream, detect JSON)
├── middlewares/
│   ├── dm-only.ts      <- Ignore les groupes (sauf notifs equipe)
│   └── rate-limit.ts   <- 3 msg / 10s max
├── services/
│   ├── claude.ts       <- chatStream() (streaming Claude)
│   ├── supabase.ts     <- Client + saveProspect()
│   ├── session.ts      <- StorageAdapter Grammy <-> Supabase
│   └── notification.ts <- notifyTeam() -> groupe prive
├── utils/
│   ├── logger.ts       <- Instance pino
│   ├── validation.ts   <- Schema Zod + extractProspectData()
│   └── stream.ts       <- streamToTelegram() (edit 500ms + clean JSON)
└── types.ts            <- TypeProjet, SessionData, ProspectResume, BotContext
```

## Regles metier importantes

- **Langue** : russe par defaut, adaptatif selon le prospect
- **Resume/notification** : toujours en russe
- **DM only** : le bot ignore les messages de groupe
- **Sessions** : persistees dans Supabase (pas en memoire)
- **Streaming** : edit message Telegram toutes les 500ms avec curseur
- **Detection fin** : balises `[PROSPECT_COMPLETE]...[/PROSPECT_COMPLETE]` dans la reponse Claude
- **/start mid-conversation** : demander confirmation avant reset
- **Multi-projet** : autorise (un prospect peut /start plusieurs fois)
- **Refus d'info** : insister une fois poliment, puis accepter
- **type_projet** : categorise automatiquement par Claude
- **Timeout** : passif 48h (detection au retour du prospect)
- **Rate limit** : 3 messages / 10 secondes
- **Max tokens Claude** : 1024
- **Historique** : tronque aux 20 derniers messages avant envoi a Claude

## Commandes

- `npm run dev` — lance le bot en polling (tsx watch)
- `npm run build` — compile TypeScript
- `npm start` — lance le build en production
- `npm test` — lance les tests vitest

## Variables d'environnement

- `TELEGRAM_BOT_TOKEN` — token @BotFather
- `ANTHROPIC_API_KEY` — cle API Anthropic
- `SUPABASE_URL` — URL projet Supabase
- `SUPABASE_SERVICE_KEY` — cle service_role Supabase
- `TELEGRAM_GROUP_ID` — ID du groupe prive equipe
- `NODE_ENV` — "production" en prod (active webhook + pino JSON)

## Conventions

- Pas d'emojis dans le code (sauf dans les messages envoyes aux utilisateurs/notifications)
- Zero code mort — supprimer plutot que commenter
- Logger pino pour tout (pas de console.log)
- Gestion d'erreur : try/catch avec message d'excuse au prospect, log pino, ne jamais planter
- Les messages d'erreur au prospect sont dans la langue detectee (russe par defaut)
