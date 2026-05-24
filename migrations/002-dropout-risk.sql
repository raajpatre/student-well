-- ────────────────────────────────────────────────────────────────────────────
-- 002-dropout-risk.sql
--
-- Adds the dropout-risk persistence layer ported (with adaptation) from
-- a sibling Newton-integration backend.
--
-- Two pieces:
--   1. lms_snapshots — append-only time series of academic data per sync.
--      Without this we have no way to compute trend-based risk factors;
--      lms_data is upserted so it only holds current state.
--   2. Two columns on lms_data — dropout_risk_score (0-100) and
--      dropout_risk_level ('low'|'medium'|'high'|'critical'). Latest
--      computed risk lives co-located with the inputs.
--
-- All additive, idempotent, safe to re-run.
-- ────────────────────────────────────────────────────────────────────────────

-- 1. lms_snapshots ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lms_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
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
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lms_snapshots_student_captured
  ON public.lms_snapshots (student_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_lms_snapshots_tenant_captured
  ON public.lms_snapshots (tenant_id, captured_at DESC);

ALTER TABLE public.lms_snapshots ENABLE ROW LEVEL SECURITY;

-- Students can't read their own snapshots — the dropout-risk surface is
-- manager/counsellor-only by design (per the integration decision).
DROP POLICY IF EXISTS "Managers read all lms_snapshots in tenant" ON public.lms_snapshots;
CREATE POLICY "Managers read all lms_snapshots in tenant"
  ON public.lms_snapshots FOR SELECT
  USING (get_auth_user_role() = 'manager' AND tenant_id = get_auth_user_tenant());

DROP POLICY IF EXISTS "Counsellors read assigned student lms_snapshots" ON public.lms_snapshots;
CREATE POLICY "Counsellors read assigned student lms_snapshots"
  ON public.lms_snapshots FOR SELECT
  USING (
    get_auth_user_role() = 'counsellor'
    AND tenant_id = get_auth_user_tenant()
    AND student_id IN (
      SELECT student_id FROM public.counsellor_assignments WHERE counsellor_id = auth.uid()
    )
  );

-- 2. dropout_risk_score + dropout_risk_level on lms_data ────────────────────
ALTER TABLE public.lms_data
  ADD COLUMN IF NOT EXISTS dropout_risk_score integer
    CHECK (dropout_risk_score BETWEEN 0 AND 100);

ALTER TABLE public.lms_data
  ADD COLUMN IF NOT EXISTS dropout_risk_level text
    CHECK (dropout_risk_level IN ('low', 'medium', 'high', 'critical'));

ALTER TABLE public.lms_data
  ADD COLUMN IF NOT EXISTS dropout_risk_factors jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.lms_data
  ADD COLUMN IF NOT EXISTS dropout_risk_computed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_lms_data_tenant_risk
  ON public.lms_data (tenant_id, dropout_risk_score DESC);
