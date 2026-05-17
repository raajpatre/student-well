# StudentWell

A student mental-health and academic wellness platform built for Indian colleges. Students get a private weekly check-in, an AI counsellor chat, and recommendation cards. Counsellors get a triage queue of students who have been flagged. Managers see population-level wellness analytics and academic risk.

The system is multi-tenant from the database up — each college is a tenant, and Supabase Row-Level Security keeps tenant data isolated even if application code is buggy.

> **Status:** active development. Not a substitute for clinical care, crisis services, or human campus support. Production deployments should add institution-specific escalation policies, consent flows, and human review procedures.

---

## What it does

| Role | Surface |
|---|---|
| **Student** | Weekly 1–5 check-in with an optional free-text reflection · AI chat (Gemini) with 3-level escalation detection · personalised recommendation cards · academic wellness pulse |
| **Counsellor** | Triage queue of assigned students · per-student wellness report · assignment status workflow |
| **Manager** | Tenant dashboard · branch/batch heatmap · flags queue · wellness-sentiment analytics · dropout-risk cohort ranking · CSV student import |

### Core pipelines

1. **Weekly check-in.** Students submit 1–5 scores plus an optional reflection. A deterministic sentiment analyzer produces severity bands; critical or distress signals raise a high-risk flag immediately and notify managers.
2. **Wellness signals.** A rolling calculator combines check-in scores into per-dimension status (good / attention / risk). Two consecutive "risk" dimensions auto-creates a flag.
3. **Recommendations.** After every check-in we generate 0–3 actionable cards based on the latest sentiment and wellness signals. One active card per type — newer cards dismiss older ones.
4. **Adaptive question rotation.** The reflection prompt rotates based on the student's dominant indicators from recent check-ins.
5. **Newton academic sync.** Students connect their [Newton School](https://my.newtonschool.co) account. The server fetches attendance / assignments / assessments via the Newton REST API, computes a dropout-risk score from a 6-factor model, and escalates to a flag when the level crosses into high or critical.
6. **AI chat.** Gemini-backed counsellor chat. Three escalation tiers — sustained distress, self-harm ideation, and immediate-risk language — raise flags and notify managers. Prompt-injection guardrails on every message.

---

## Tech stack

- **Server.** TypeScript, Express, Supabase JS client. Pino for logging, Zod for input validation, helmet + express-rate-limit for hardening.
- **Client.** React 19, Vite 8, Tailwind, Material Symbols. Plain `fetch` via a small wrapper at `client/src/lib/api.ts`.
- **Database & auth.** Supabase (Postgres + Auth + Row-Level Security). All tenant isolation is enforced both in route handlers AND at the database level.
- **AI.** Google Gemini for chat (`@google/generative-ai`). Anthropic SDK is wired but currently unused for chat. A deterministic keyword-lexicon sentiment analyzer handles reflections.
- **Newton integration.** Direct REST against `https://my.newtonschool.co` — the original MCP binary is macOS-arm64 only and can't run on Render's Linux runtime. See `scripts/newton-api-contract.json` for the discovered endpoint set.
- **Hosting.** Render for the API, Vercel for the client (any combination of host + Postgres works).

---

## Project layout

```
.
├── client/          React + Vite frontend
├── server/          Express TypeScript API
├── shared/          Cross-target types (re-exported via tsconfig path)
├── migrations/      Idempotent SQL migrations — apply in numeric order
├── schema.sql       Initial-state snapshot of the database
├── scripts/         Dev tooling (Newton discovery, smoke tests)
└── docs/            Setup + architecture documentation
```

---

## Quick start

### Prerequisites

- Node.js ≥ 20
- A Supabase project (free tier is fine)
- A Google Gemini API key
- *(optional)* A Newton School account if you want to test the academic-sync flow

### 1. Clone and install

```bash
git clone https://github.com/<your-handle>/StudentWell.git
cd StudentWell
npm install            # installs all three workspaces
```

### 2. Bootstrap the database

Open the Supabase SQL editor and run, in order:

1. `schema.sql` (base tables + RLS policies)
2. `migrations/001-wellness-engine.sql` (reflections, recommendations, adaptive questions)
3. `migrations/002-dropout-risk.sql` (lms_snapshots + dropout_risk columns)

Each migration is additive and idempotent — safe to re-run.

See [`docs/DATABASE_SETUP.md`](docs/DATABASE_SETUP.md) for a full walkthrough including the additional columns the live deployment carries (per-dimension `*_score` and `*_suggestion` on `wellness_signals`, the `lms_data` and `newton_credentials` tables, and the `user_preferences` table).

### 3. Configure environment variables

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Fill in the variables. Both files have inline comments explaining each one.

### 4. Run locally

```bash
npm run dev            # client on :5173, server on :3001 (concurrently)
```

Open http://localhost:5173.

---

## Environment variables

### Server (`server/.env`)

| Var | Required | Notes |
|---|---|---|
| `PORT` | no | Defaults to `3001`. |
| `CLIENT_URL` | yes | Frontend origin, e.g. `http://localhost:5173`. Used in the CORS allowlist. |
| `SUPABASE_URL` | yes | From the Supabase project settings. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | **Server-only secret.** Never expose to the client. |
| `GEMINI_API_KEY` | yes | From Google AI Studio. Used for chat. |
| `ENCRYPTION_KEY` | yes | 64 hex characters (32 bytes). Generate via `openssl rand -hex 32`. Used to encrypt Newton tokens at rest. **Rotating this invalidates all stored tokens.** |
| `JWT_SECRET` | yes | Used for additional verification. Should match the Supabase project's JWT secret if you're verifying Supabase tokens. |
| `NODE_ENV` | yes | `development` or `production`. Disables stack traces in error responses when `production`. |
| `WHATSAPP_API_TOKEN` | no | Required if WhatsApp notifications are enabled. |
| `WHATSAPP_PHONE_NUMBER_ID` | no | Same — leave blank to fall back to in-app notifications only. |

### Client (`client/.env`)

| Var | Required | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | yes | Same as server side. |
| `VITE_SUPABASE_ANON_KEY` | yes | **Anon key, not service role.** Safe to ship to the browser. |
| `VITE_API_BASE_URL` | yes | Server origin, e.g. `http://localhost:3001`. |

---

## Tests

There are no automated unit tests yet. There are three runnable smoke scripts that exercise the core pure functions:

```bash
npx tsx scripts/test-sentiment.ts       # sentiment analyzer
npx tsx scripts/test-dropout-risk.ts    # dropout-risk scoring
npx tsx scripts/test-newton-client.ts   # requires ~/.newton-mcp/credentials.json
```

The dropout-risk script needs `SUPABASE_URL`, `ENCRYPTION_KEY`, etc. set (because of transitive imports) — any valid-shape stub values work since it never hits the DB.

---

## Security

See [`SECURITY.md`](SECURITY.md) for the vulnerability-disclosure policy. Highlights of the model:

- Multi-tenant isolation enforced at the Postgres level via RLS, not just in application code.
- Newton tokens are AES-256-GCM encrypted with a server-only key before storage; never logged.
- Three-level escalation detection on chat messages and on check-in reflections; level 2 and 3 immediately raise flags.
- Per-user rate limits on chat, check-ins, sync, and login.
- Prompt-injection patterns are stripped from chat input before the message reaches the LLM.
- Service role key never reaches the browser — the anon key is used client-side, and all writes go through tenant-aware server routes.

---

## Contributing

Contributions welcome. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for local-dev setup, branch naming, and PR conventions.

---

## License

MIT. See [`LICENSE`](LICENSE).
