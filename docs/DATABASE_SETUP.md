# Database setup

This walks through bootstrapping a fresh Supabase project for StudentWell.

## Prerequisites

- A Supabase project (free tier is fine).
- The project URL and both keys: the `anon` key for the client, the `service_role` key for the server.

## Run order

In the Supabase SQL editor, run each block in order. Every script is additive and idempotent — you can re-run any of them safely.

### 1. Base schema

Paste the contents of [`schema.sql`](../schema.sql) and run it. This creates:

- Helper functions `get_auth_user_tenant()` and `get_auth_user_role()`.
- 14 base tables — `colleges`, `users`, `checkins`, `wellness_signals`, `flags`, `counsellor_assignments`, `counsellor_profiles`, `profile_edit_requests`, `chatbot_sessions`, `chatbot_messages`, `social_spaces`, `social_posts`, `audit_logs`, `notifications`.
- All RLS policies for those tables.
- Standard indexes.
- Three additional tables that the live deployment carries — `lms_data`, `newton_credentials`, `user_preferences` — plus per-dimension `*_score` and `*_suggestion` columns on `wellness_signals`. These live at the bottom of `schema.sql` under "Live-deployment additions" and are idempotent.

### 2. Wellness-engine migration

Paste and run [`migrations/001-wellness-engine.sql`](../migrations/001-wellness-engine.sql). This creates:

- `weekly_reflections` — optional free-text companion to the 1–5 check-in, with sentiment indicators.
- `recommendations` — actionable suggestion cards per student.
- `adaptive_questions` — shared library of check-in prompts rotated by dominant indicators. Seeded with 10 default prompts.

### 3. Dropout-risk migration

Paste and run [`migrations/002-dropout-risk.sql`](../migrations/002-dropout-risk.sql). This adds:

- `lms_snapshots` — append-only time series of academic data, one row per Newton sync. Powers the trend-based factors in the dropout-risk model.
- Four new columns on `lms_data`: `dropout_risk_score`, `dropout_risk_level`, `dropout_risk_factors` (jsonb), `dropout_risk_computed_at`.

### 4. Seed at least one tenant + manager user

```sql
-- One college (tenant)
INSERT INTO public.colleges (id, name, slug)
VALUES (gen_random_uuid(), 'Demo College', 'demo-college')
ON CONFLICT (slug) DO NOTHING;
```

Then create your first manager user through the Supabase Auth UI (Email + Password), grab the new `auth.users.id`, and:

```sql
INSERT INTO public.users (id, tenant_id, role, full_name)
VALUES (
  '<your-auth-uid>',
  (SELECT id FROM public.colleges WHERE slug = 'demo-college'),
  'manager',
  'Demo Manager'
);
```

Sign in to StudentWell with that email/password.

## Resetting

To wipe and start over (development only):

```sql
-- Drops every public table including data. Do NOT run on a live deployment.
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres, anon, authenticated, service_role;
```

Then re-run steps 1–5.
