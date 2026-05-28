-- Migration: Student Invite System + Institution Email Domain Lock
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- ── Part A: Institution Email Domain Lock ─────────────────────────────────────

ALTER TABLE colleges
  ADD COLUMN IF NOT EXISTS allowed_email_domains TEXT[] DEFAULT '{}';

-- Example: update NST to allow their domains
-- UPDATE colleges SET allowed_email_domains = ARRAY['newtonschool.co', 'nst.edu.in', 'gmail.com']
-- WHERE name = 'Newton School of Technology';

-- ── Part B: Student Invites Table ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS student_invites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  roll_number     TEXT NOT NULL,
  batch           TEXT NOT NULL,
  semester        INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 8),
  invited_by      UUID NOT NULL REFERENCES users(id),
  auth_user_id    UUID REFERENCES users(id),
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'activated', 'expired', 'resent')),
  invite_token    TEXT UNIQUE NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  activated_at    TIMESTAMPTZ,
  resend_count    INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique indexes: only enforce uniqueness for active (non-expired) invites
-- This allows re-inviting a student after their previous invite expires
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_invites_unique_active_email
  ON student_invites (tenant_id, email)
  WHERE status != 'expired';

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_invites_unique_active_roll
  ON student_invites (tenant_id, roll_number)
  WHERE status != 'expired';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_student_invites_tenant_status  ON student_invites (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_student_invites_invite_token   ON student_invites (invite_token);
CREATE INDEX IF NOT EXISTS idx_student_invites_expires_at     ON student_invites (expires_at);

-- RLS: only service role can read/write (backend uses service key)
ALTER TABLE student_invites ENABLE ROW LEVEL SECURITY;

-- Deny all access from the anon/authenticated roles (service role bypasses RLS)
CREATE POLICY "No public access to student_invites"
  ON student_invites
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
