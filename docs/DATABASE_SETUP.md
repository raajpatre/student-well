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

### 2. Live-deployment columns and tables

`schema.sql` is a baseline snapshot. The live deployment has accumulated additional columns and tables that are referenced by the code but not yet in the baseline:

- `wellness_signals.*_score` and `wellness_signals.*_suggestion` columns (per dimension)
- `wellness_signals.updated_at`
- `lms_data` table (current academic snapshot per student)
- `newton_credentials` table (encrypted Newton tokens)
- `user_preferences` table (check-in cadence, delivery channel, etc.)

These were added directly against the live database during development. Until they're folded into `schema.sql`, run the following one-off block:

```sql
-- ── wellness_signals: per-dimension score + suggestion + updated_at ────────
ALTER TABLE public.wellness_signals
  ADD COLUMN IF NOT EXISTS academic_score integer,
  ADD COLUMN IF NOT EXISTS emotional_score integer,
  ADD COLUMN IF NOT EXISTS social_score integer,
  ADD COLUMN IF NOT EXISTS academic_suggestion text,
  ADD COLUMN IF NOT EXISTS emotional_suggestion text,
  ADD COLUMN IF NOT EXISTS social_suggestion text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ── lms_data: current academic state per student (Newton sync target) ─────
CREATE TABLE IF NOT EXISTS public.lms_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
  student_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'newton_mcp',
  attendance_pct numeric(5,2),
  assignment_completion_pct numeric(5,2),
  assessments_completed integer,
  assessments_total integer,
  lectures_attended integer,
  lectures_total integer,
  xp_total integer,
  batch_rank integer,
  batch_size integer,
  raw_data jsonb,
  synced_at timestamptz DEFAULT now()
);

ALTER TABLE public.lms_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read own lms_data" ON public.lms_data;
CREATE POLICY "Students read own lms_data"
  ON public.lms_data FOR SELECT
  USING (student_id = auth.uid() AND tenant_id = get_auth_user_tenant());

DROP POLICY IF EXISTS "Managers read all lms_data" ON public.lms_data;
CREATE POLICY "Managers read all lms_data"
  ON public.lms_data FOR SELECT
  USING (get_auth_user_role() = 'manager' AND tenant_id = get_auth_user_tenant());

DROP POLICY IF EXISTS "Counsellors read assigned lms_data" ON public.lms_data;
CREATE POLICY "Counsellors read assigned lms_data"
  ON public.lms_data FOR SELECT
  USING (
    get_auth_user_role() = 'counsellor'
    AND tenant_id = get_auth_user_tenant()
    AND student_id IN (
      SELECT student_id FROM public.counsellor_assignments WHERE counsellor_id = auth.uid()
    )
  );

-- ── newton_credentials: encrypted token per student ───────────────────────
CREATE TABLE IF NOT EXISTS public.newton_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
  student_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  encrypted_token text NOT NULL,
  expires_at bigint,
  newton_course_hash text,
  newton_course_name text,
  newton_student_count integer,
  connected_at timestamptz DEFAULT now(),
  last_sync_at timestamptz,
  last_sync_status text,
  last_sync_error text
);

ALTER TABLE public.newton_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students rw own newton_credentials" ON public.newton_credentials;
CREATE POLICY "Students rw own newton_credentials"
  ON public.newton_credentials FOR ALL
  USING (student_id = auth.uid() AND tenant_id = get_auth_user_tenant());

-- Managers and counsellors should NOT read decrypted tokens; they read sync
-- status only via a server-side route that selects safe columns.
DROP POLICY IF EXISTS "Managers read newton sync status" ON public.newton_credentials;
CREATE POLICY "Managers read newton sync status"
  ON public.newton_credentials FOR SELECT
  USING (get_auth_user_role() = 'manager' AND tenant_id = get_auth_user_tenant());

-- ── user_preferences ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
  student_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  checkin_day integer DEFAULT 1,
  checkin_time time DEFAULT '18:00:00',
  delivery_preference text DEFAULT 'in_app',
  language text DEFAULT 'en',
  notifications_enabled boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students rw own preferences" ON public.user_preferences;
CREATE POLICY "Students rw own preferences"
  ON public.user_preferences FOR ALL
  USING (student_id = auth.uid() AND tenant_id = get_auth_user_tenant());
```

### 3. Wellness-engine migration

Paste and run [`migrations/001-wellness-engine.sql`](../migrations/001-wellness-engine.sql). This creates:

- `weekly_reflections` — optional free-text companion to the 1–5 check-in, with sentiment indicators.
- `recommendations` — actionable suggestion cards per student.
- `adaptive_questions` — shared library of check-in prompts rotated by dominant indicators. Seeded with 10 default prompts.

### 4. Dropout-risk migration

Paste and run [`migrations/002-dropout-risk.sql`](../migrations/002-dropout-risk.sql). This adds:

- `lms_snapshots` — append-only time series of academic data, one row per Newton sync. Powers the trend-based factors in the dropout-risk model.
- Four new columns on `lms_data`: `dropout_risk_score`, `dropout_risk_level`, `dropout_risk_factors` (jsonb), `dropout_risk_computed_at`.

### 5. Seed at least one tenant + manager user

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
