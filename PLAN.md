# Plan — Mira, Bot Telegram IA pour Tsarag

## Contexte

L'equipe **Tsarag** (developpeurs web, sensei 50k+ abonnes Instagram) lance **Mira**, un bot Telegram propulse par Claude AI. Le lien en bio Instagram pointe vers le bot. Mira receptionne les prospects, guide la conversation en 5 phases, stocke le profil dans Supabase, et notifie l'equipe dans un groupe Telegram prive.

---

## Decisions finales

| Sujet | Decision |
|---|---|
| Nom du bot | **Mira** — assistante de Tsarag |
| Langue d'accueil | **Russe par defaut**, adaptatif selon le prospect |
| Resume/notification | **Toujours en russe** |
| Sessions | Persistees dans **Supabase** |
| Streaming | **Oui** — edit message toutes les 500ms, buffer complet pour detecter `[PROSPECT_COMPLETE]`, dernier edit nettoie le JSON |
| /start mid-conversation | **Demander confirmation** avant reset |
| Multi-projet | **Autorise** — /start apres phase termine cree une nouvelle session |
| Categorisation type_projet | **Automatique par Claude** (deduit de la conversation) |
| Refus d'info | **Insister une fois poliment**, puis accepter |
| Validation contacts | **Basique** (email contient @, WhatsApp accepte tout) |
| DM only | **Oui** — ignorer les messages de groupe (sauf poster notifs) |
| Groupe equipe | **Notifications seulement**, pas d'interaction |
| Timeout | **Passif 48h** — detection quand le prospect revient |
| Rate limiting | **3 msg / 10s** |
| Cas edge | **Complet** (rate limit, timeout, /cancel, /help, Zod, retry Claude) |
| Logger | **pino** structure |
| Tests | **Unitaires de base** (validation, extraction JSON, service Claude mock) |
| Package manager | **npm** |
| Max tokens Claude | **1024** |
| Git | **Init immediat** |
| Deploiement | **Railway** (webhook prod, polling local) |

---

## Structure du projet

```
telegram-bot/
├── src/
│   ├── bot.ts                  <- Point d'entree, assemblage Grammy
│   ├── config/
│   │   ├── prompts.ts          <- System prompt Claude (Mira / Tsarag)
│   │   └── constants.ts        <- Limites, timeouts, modele Claude
│   ├── handlers/
│   │   ├── start.ts            <- /start — confirmation si actif, reset, accueil
│   │   ├── cancel.ts           <- /cancel — reset session
│   │   ├── help.ts             <- /help — info sur le bot
│   │   └── message.ts          <- Messages texte — logique principale
│   ├── middlewares/
│   │   ├── rate-limit.ts       <- Rate limiting (3 msg / 10s)
│   │   └── dm-only.ts          <- Filtre DM uniquement (ignore groupes)
│   ├── services/
│   │   ├── claude.ts           <- Appels Claude API + streaming + retry
│   │   ├── supabase.ts         <- Client Supabase + CRUD prospects
│   │   ├── session.ts          <- Adapter session Grammy <-> Supabase
│   │   └── notification.ts     <- Notif groupe Telegram equipe
│   ├── utils/
│   │   ├── logger.ts           <- Logger pino configure
│   │   ├── validation.ts       <- Schemas Zod + extraction JSON
│   │   └── stream.ts           <- Logique streaming Telegram (edit message)
│   └── types.ts                <- Types TypeScript
├── tests/
│   ├── validation.test.ts      <- Tests extraction JSON + Zod
│   └── claude.test.ts          <- Tests service Claude (mock)
├── .env.example
├── .gitignore
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

## Les 5 phases de conversation

**Phase 1 — Accueil** : Mira se presente chaleureusement en russe, demande le prenom et le nom de l'entreprise ou marque.

**Phase 2 — Decouverte** : Quel type de projet ? Qu'est-ce que le client fait ou vend ? Questions orientees metier, jamais techniques.

**Phase 3 — Brainstorming** : Comprendre le probleme du client en profondeur — ce qu'il veut accomplir, ce qui ne marche pas aujourd'hui, ce qu'il imagine comme resultat ideal.

**Phase 4 — Logistique** : Delais souhaites, contraintes particulieres, budget approximatif.

**Phase 5 — Cloture** : Collecte email et WhatsApp (insister une fois si refus), confirme que l'equipe recontactera sous 24-48h, genere le resume JSON en interne, declenche la sauvegarde et la notification.

---

## Etapes d'implementation

### Etape 1 — Setup projet + Git
- `git init` + `npm init -y`
- Runtime : `grammy`, `@anthropic-ai/sdk`, `@supabase/supabase-js`, `zod`, `dotenv`, `pino`, `pino-pretty`
- Dev : `typescript`, `tsx`, `@types/node`, `vitest`
- tsconfig : ES2022, NodeNext, strict, outDir dist/
- Scripts : dev (tsx watch), build (tsc), start (node dist/bot.js), test (vitest run)

### Etape 2 — Tables Supabase (SQL manuel)
- Table `prospects` (id, telegram_id, nom, whatsapp, email, entreprise, type_projet, delais, description, resume, statut, assigne_a)
- Table `sessions` (key, value jsonb, updated_at)

### Etape 3 — Types (`src/types.ts`)
- TypeProjet, SessionData (avec lastActivity), Prospect, BotContext

### Etape 4 — Logger + Config
- `src/utils/logger.ts` : pino + pino-pretty en dev
- `src/config/constants.ts` : toutes les constantes
- `src/config/prompts.ts` : system prompt Mira/Tsarag

### Etape 5 — Service Supabase (`src/services/supabase.ts`)
- Client + saveProspect()

### Etape 6 — Session adapter (`src/services/session.ts`)
- StorageAdapter Grammy <-> table sessions Supabase

### Etape 7 — Service Claude streaming (`src/services/claude.ts`)
- chatStream() avec truncation 20 messages + retry backoff

### Etape 8 — Streaming Telegram (`src/utils/stream.ts`)
- streamToTelegram() : placeholder -> edit 500ms -> detect [PROSPECT_COMPLETE] -> clean JSON

### Etape 9 — Validation Zod (`src/utils/validation.ts`)
- prospectSchema + extractProspectData()

### Etape 10 — Notification (`src/services/notification.ts`)
- notifyTeam() -> message formate dans le groupe equipe

### Etape 11 — Middleware DM-only (`src/middlewares/dm-only.ts`)

### Etape 12 — Middleware rate limiting (`src/middlewares/rate-limit.ts`)

### Etape 13 — Handler /start (`src/handlers/start.ts`)
- Confirmation si conversation active, reset, accueil Claude en russe

### Etape 14 — Handlers /cancel et /help

### Etape 15 — Handler message (`src/handlers/message.ts`)
- Logique principale : non-texte -> timeout -> termine -> typing -> stream Claude -> detect JSON -> save/notify

### Etape 16 — Bot principal (`src/bot.ts`)
- Assemblage : env validation, middlewares, handlers, polling/webhook, graceful shutdown

### Etape 17 — Tests (vitest)
- validation.test.ts + claude.test.ts

### Etape 18 — Dockerfile + Railway

---

## Verification

1. Local : `npm run dev` -> /start -> Mira se presente en russe
2. Flow complet : 5 phases -> JSON detecte -> Supabase -> notif groupe
3. Streaming : reponse progressive dans Telegram
4. Cas edge : sticker, spam, /cancel, /start mid-conv, timeout 48h, phase termine, refus email, JSON mal forme
5. Tests : `npm test` -> tous passent
6. Deploy : push GitHub -> Railway -> webhook -> test prod
