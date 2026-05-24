-- ────────────────────────────────────────────────────────────────────────────
-- 001-wellness-engine.sql
--
-- Adds three new pieces of capability ported from a sibling backend
-- (sentiment-driven free-text reflections, adaptive questions, and
-- recommendations) on top of the existing 1–5 weekly check-in flow.
--
-- All additive — no destructive changes, no column drops. Safe to run
-- against a live database. Each block is idempotent via IF NOT EXISTS.
-- ────────────────────────────────────────────────────────────────────────────

-- 1. weekly_reflections ─────────────────────────────────────────────────────
-- Optional free-text response companion to the 1–5 check-in. One row per
-- (student, week_start). The sentiment fields are derived server-side from
-- the deterministic sentiment analyzer.
CREATE TABLE IF NOT EXISTS public.weekly_reflections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  reflection_text text NOT NULL,
  sentiment_label text CHECK (sentiment_label IN ('positive', 'neutral', 'negative')),
  emotional_score integer CHECK (emotional_score BETWEEN 0 AND 100),
  severity text CHECK (severity IN ('Low', 'Moderate', 'High', 'Critical')),
  indicators jsonb DEFAULT '{}'::jsonb,
  detected_keywords text[] DEFAULT ARRAY[]::text[],
  created_at timestamptz DEFAULT now(),
  UNIQUE (student_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_reflections_student_week
  ON public.weekly_reflections (student_id, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_reflections_tenant_severity
  ON public.weekly_reflections (tenant_id, severity, created_at DESC);

ALTER TABLE public.weekly_reflections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students rw own reflections" ON public.weekly_reflections;
CREATE POLICY "Students rw own reflections"
  ON public.weekly_reflections FOR ALL
  USING (student_id = auth.uid() AND tenant_id = get_auth_user_tenant());

DROP POLICY IF EXISTS "Managers read all reflections" ON public.weekly_reflections;
CREATE POLICY "Managers read all reflections"
  ON public.weekly_reflections FOR SELECT
  USING (get_auth_user_role() = 'manager' AND tenant_id = get_auth_user_tenant());

DROP POLICY IF EXISTS "Counsellors read assigned student reflections" ON public.weekly_reflections;
CREATE POLICY "Counsellors read assigned student reflections"
  ON public.weekly_reflections FOR SELECT
  USING (
    get_auth_user_role() = 'counsellor'
    AND tenant_id = get_auth_user_tenant()
    AND student_id IN (
      SELECT student_id FROM public.counsellor_assignments WHERE counsellor_id = auth.uid()
    )
  );

-- 2. recommendations ────────────────────────────────────────────────────────
-- Per-student actionable suggestion cards generated after wellness recalculation.
CREATE TABLE IF NOT EXISTS public.recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('self-care', 'sleep', 'social', 'academic-balance', 'counseling', 'urgent-support')),
  priority text NOT NULL DEFAULT 'Low' CHECK (priority IN ('Low', 'Moderate', 'High', 'Critical')),
  message text NOT NULL,
  source text NOT NULL CHECK (source IN ('wellness-score', 'reflection', 'social-isolation', 'chatbot', 'weekly-recap')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dismissed', 'completed')),
  created_at timestamptz DEFAULT now(),
  dismissed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_recommendations_student_active
  ON public.recommendations (student_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recommendations_tenant_priority
  ON public.recommendations (tenant_id, priority, created_at DESC);

ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read own recommendations" ON public.recommendations;
CREATE POLICY "Students read own recommendations"
  ON public.recommendations FOR SELECT
  USING (student_id = auth.uid() AND tenant_id = get_auth_user_tenant());

DROP POLICY IF EXISTS "Students update own recommendations" ON public.recommendations;
CREATE POLICY "Students update own recommendations"
  ON public.recommendations FOR UPDATE
  USING (student_id = auth.uid() AND tenant_id = get_auth_user_tenant());

DROP POLICY IF EXISTS "Managers read all recommendations" ON public.recommendations;
CREATE POLICY "Managers read all recommendations"
  ON public.recommendations FOR SELECT
  USING (get_auth_user_role() = 'manager' AND tenant_id = get_auth_user_tenant());

DROP POLICY IF EXISTS "Counsellors read assigned recommendations" ON public.recommendations;
CREATE POLICY "Counsellors read assigned recommendations"
  ON public.recommendations FOR SELECT
  USING (
    get_auth_user_role() = 'counsellor'
    AND tenant_id = get_auth_user_tenant()
    AND student_id IN (
      SELECT student_id FROM public.counsellor_assignments WHERE counsellor_id = auth.uid()
    )
  );

-- 3. adaptive_questions ─────────────────────────────────────────────────────
-- Shared library of check-in / reflection prompts the server rotates based on
-- a student's dominant indicators from recent reflections. Read-only for
-- students; managers can curate (via direct admin write — no public mutation
-- endpoint yet).
CREATE TABLE IF NOT EXISTS public.adaptive_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  category text NOT NULL CHECK (category IN ('stress', 'sleep', 'social', 'burnout', 'motivation', 'anxiety', 'general')),
  priority_weight integer NOT NULL DEFAULT 5 CHECK (priority_weight BETWEEN 1 AND 10),
  triggers text[] DEFAULT ARRAY[]::text[],
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_adaptive_questions_active_priority
  ON public.adaptive_questions (active, priority_weight DESC);

ALTER TABLE public.adaptive_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Any authenticated user can read active questions" ON public.adaptive_questions;
CREATE POLICY "Any authenticated user can read active questions"
  ON public.adaptive_questions FOR SELECT
  TO authenticated
  USING (active = true);

-- Seed the question bank (idempotent — only inserts if empty).
INSERT INTO public.adaptive_questions (text, category, priority_weight, triggers)
SELECT * FROM (VALUES
  ('How heavy did this week feel?', 'stress', 7, ARRAY['stress']),
  ('What is currently taking up the most space in your head?', 'general', 5, ARRAY['stress','anxiety']),
  ('How connected did campus feel lately?', 'social', 7, ARRAY['loneliness']),
  ('How rested have you actually felt?', 'sleep', 8, ARRAY['sleepDecline','exhaustion']),
  ('How chaotic has life been recently?', 'stress', 6, ARRAY['stress']),
  ('What has been taking the most energy from you?', 'burnout', 9, ARRAY['exhaustion']),
  ('How easy has it been to start assignments lately?', 'motivation', 6, ARRAY['motivationDecline']),
  ('How loud have your worries felt this week?', 'anxiety', 8, ARRAY['anxiety']),
  ('When did you last do something for yourself this week?', 'burnout', 5, ARRAY['exhaustion','motivationDecline']),
  ('Is there a small win from this week worth naming?', 'general', 4, ARRAY[]::text[])
) AS seed(text, category, priority_weight, triggers)
WHERE NOT EXISTS (SELECT 1 FROM public.adaptive_questions);
