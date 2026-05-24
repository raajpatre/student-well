<h1 align="center"> 🌱StudentWell</h1>

<p align="center">
  <em>A mental-health and academic wellness platform built for Indian colleges.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Gemini_AI-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white" alt="Gemini" />
  <img src="https://img.shields.io/badge/Vite_8-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest" />
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/raajpatre/student-well?style=for-the-badge&color=FFD700" alt="Stars" />
  <img src="https://img.shields.io/github/last-commit/raajpatre/student-well?style=for-the-badge&color=3FCF8E" alt="Last Commit" />
  <img src="https://img.shields.io/badge/Status-Active_Development-orange?style=for-the-badge" alt="Status" />
</p>

<p align="center">
  <a href="https://student-well-client.vercel.app">🌐 Live Demo</a> ·
  <a href="#-what-it-does">What it does</a> ·
  <a href="#-architecture">Architecture</a> ·
  <a href="#-quick-start">Quick Start</a>
</p>

> ⚠️ **Clinical disclaimer:** StudentWell is a supportive tool — not a substitute for clinical care, crisis services, or human campus support. The AI chat surfaces flags to counsellors; it does not diagnose or treat. Institutions deploying this should layer in their own escalation policies, consent flows, and human review procedures.

---

## 📸 Gallery

<table>
  <tr>
    <td align="center"><strong>Student — Home Page</strong></td>
    <td align="center"><strong>Student — Weekly Trends</strong></td>
    <td align="center"><strong>Student — Ai Well-Being Chat</strong></td>
    <td align="center"><strong>Student — Settings</strong></td>
  </tr>
  <tr>
    <td><img width="489" height="860" alt="Screenshot 2026-05-18 at 1 55 47 PM" src="https://github.com/user-attachments/assets/8bfcdd86-d3ae-4e3b-99cf-31b5e4e99adc" /></td>
    <td><img width="489" height="859" alt="Screenshot 2026-05-18 at 2 04 22 PM" src="https://github.com/user-attachments/assets/8b9284d5-534d-4d68-ab8a-24e442bb507a" /></td>
    <td><img width="490" height="861" alt="Screenshot 2026-05-18 at 2 04 28 PM" src="https://github.com/user-attachments/assets/80d00ba0-5dc2-4ad2-8ef8-23eb8025c9f3" /></td>
    <td><img width="489" height="861" alt="Screenshot 2026-05-18 at 2 04 35 PM" src="https://github.com/user-attachments/assets/231ce4a4-e3c4-45cf-91ad-b2f9c40578e9" /></td>
  </tr>
</table>
<table>
  <tr>
    <td align="center"><strong>Manager — Overview Dashboard</strong></td>
    <td align="center"><strong>Manager — Students Risk Board</strong></td>
  </tr>
  <tr>
    <td><img width="1512" height="861" alt="Screenshot 2026-05-18 at 1 56 44 PM" src="https://github.com/user-attachments/assets/376526f0-10d2-45b8-8f11-f4b2f64f45d9" /></td>
    <td><img width="1512" height="862" alt="Screenshot 2026-05-18 at 1 56 51 PM" src="https://github.com/user-attachments/assets/dc969919-d625-4faa-a0a1-50bcdb578f54" /></td>
  </tr>
  <tr>
    <td align="center"><strong>Manager — Available Counsellors</strong></td>
    <td align="center"><strong>Manager — Batch Wise Semester Report</strong></td>
  </tr>
  <tr>
    <td><img width="1512" height="863" alt="Screenshot 2026-05-18 at 1 56 58 PM" src="https://github.com/user-attachments/assets/e8f98abb-55c0-40e5-87f6-2fe547110db4" /></td>
    <td><img width="1512" height="862" alt="Screenshot 2026-05-18 at 1 57 24 PM" src="https://github.com/user-attachments/assets/c8cb04f7-1e54-4397-a8d3-5bad1af3e089" /</td>
  </tr>
</table>

---

## 📖 What It Does

StudentWell serves three roles inside a college — each sees a different surface of the same data:

| Role | What they see |
|---|---|
| **Student** | Weekly 1–5 check-in with optional free-text reflection · AI chat (Gemini) with 3-level escalation detection · personalised recommendation cards · academic wellness pulse |
| **Counsellor** | Triage queue of flagged students · per-student wellness report · assignment status workflow |
| **Manager** | Tenant dashboard · branch/batch heatmap · flags queue · wellness-sentiment analytics · dropout-risk cohort ranking · CSV student import |

The system is multi-tenant from the database up — each college is a Supabase tenant, and Row-Level Security keeps data isolated even if application code is buggy.

---

## ⚙️ Core Pipelines

**1. Weekly check-in.** Students submit 1–5 scores across wellness dimensions plus an optional free-text reflection. A deterministic sentiment analyser produces severity bands; critical or distress signals raise a high-risk flag immediately and notify counsellors.

**2. Wellness signals.** A rolling calculator combines check-in scores into per-dimension status (good / attention / risk). Two consecutive "risk" dimensions auto-create a flag.

**3. Recommendations.** After every check-in, 0–3 actionable cards are generated based on the latest sentiment and wellness signals. One active card per type — newer cards dismiss older ones.

**4. Adaptive question rotation.** The reflection prompt rotates based on the student's dominant indicators from recent check-ins.

**5. Newton academic sync.** Students connect their Newton School account. The server fetches attendance, assignments, and assessments via Newton's REST API, computes a dropout-risk score from a 6-factor model, and escalates to a flag when the level crosses high or critical.

**6. AI chat.** Gemini-backed counsellor chat with three escalation tiers — sustained distress, self-harm ideation, and immediate-risk language. Flags are raised and managers notified. Prompt-injection guardrails run on every message.

---

## 🏗️ Architecture

### Stack

| Layer | Choice | Detail |
|---|---|---|
| Client | React 19 + Vite 8 + Tailwind | Plain `fetch` via a typed wrapper at `client/src/lib/api.ts` |
| Server | TypeScript + Express | Zod for input validation · Pino for structured logging · helmet + rate-limit |
| Database & auth | Supabase (Postgres + Auth + RLS) | Tenant isolation enforced at both route handler AND database level |
| AI | Google Gemini (`@google/generative-ai`) | 3-tier escalation · prompt-injection guardrails on every message |
| Academic sync | Newton School REST API | Direct REST against `https://my.newtonschool.co` — note: Newton integration currently macOS/arm64 only, not compatible with Render's Linux runtime |
| Testing | Vitest | Coverage across core wellness engine and dropout-risk scoring logic |
| Hosting | Vercel (client) + Render (server) | Any host + Supabase Postgres combination works |

### Project Layout

```
student-well/
├── client/       React + Vite frontend
├── server/       Express TypeScript API
├── shared/       Cross-target types (re-exported via tsconfig path)
├── migrations/   Idempotent SQL migrations — apply in numeric order
├── schema.sql    Initial-state snapshot of the database
├── scripts/      Dev tooling (Newton API discovery, smoke tests)
└── docs/         Setup + architecture documentation
```

---

## Quick Start 🔥

### Prerequisites

- Node.js ≥ 20
- A Supabase project (free tier is fine)
- A Google Gemini API key
- *(MANDATORY)* A Newton School account to test the academic-sync flow

### 1. Clone and install

```bash
git clone https://github.com/raajpatre/student-well.git
cd student-well
npm install        # installs all three workspaces
```

### 2. Bootstrap the database

Open the Supabase SQL editor and run, in order:

1. `schema.sql` — base tables + RLS policies
2. `migrations/001-wellness-engine.sql` — reflections, recommendations, adaptive questions
3. `migrations/002-newton-academic.sql` — dropout-risk scoring schema
4. `migrations/003-ai-chat.sql` — Gemini chat tables + escalation log
5. `migrations/004-manager-analytics.sql` — cohort ranking, sentiment analytics views

### 3. Configure environment

Copy `.env.example` files in `client/` and `server/` and fill in:

**`server/.env.local`**
```env
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
GEMINI_API_KEY=<your-gemini-key>
CLIENT_ORIGIN=http://localhost:5173
PORT=4000
```

**`client/.env.local`**
```env
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_API_BASE_URL=http://localhost:4000
```

### 4. Run

```bash
npm run dev:server
npm run dev:client
```

Open [http://localhost:5173](http://localhost:5173).

---

## 🧪 Tests

```bash
npm run test --workspace server
```

Vitest covers the wellness signal engine, dropout-risk scoring, and recommendation card generation. Add `--coverage` for a coverage report.

---

## 🔐 Security Notes

- All sensitive routes are Supabase-auth gated server-side and double-checked against RLS at the database level
- Gemini chat has prompt-injection guardrails on every message before it reaches the model
- The service-role key is server-only — never exposed to the client
- Rate limiting (`express-rate-limit`) applied on all API routes
- See `SECURITY.md` for the full threat model and disclosure process

---

## 🗺️ Roadmap

- [ ] WhatsApp notification channel (currently env-gated)
- [ ] Newton integration on Linux runtime (blocked on binary compatibility)
- [ ] Full Anthropic SDK integration for counsellor-facing advanced analysis
- [ ] Consent and data-retention policy management UI
- [ ] Exportable wellness reports (PDF)

---

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). This is a student project under active development — issues and PRs welcome.

---

## 📄 License

MIT — see [LICENSE](./LICENSE).

---

<p align="center">
  <em>Built by <a href="https://github.com/raajpatre">raajpatre</a></em>
</p>
