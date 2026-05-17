-- Helper functions for RLS
CREATE OR REPLACE FUNCTION public.get_auth_user_tenant()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT tenant_id FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM public.users WHERE id = auth.uid() LIMIT 1;
$$;

-- 1. colleges
CREATE TABLE public.colleges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text UNIQUE NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 2. users
CREATE TABLE public.users (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('student', 'counsellor', 'manager')),
    full_name text NOT NULL,
    roll_number text,
    phone text,
    branch text,
    batch text,
    semester integer,
    is_active boolean DEFAULT true,
    notification_preference text DEFAULT 'whatsapp',
    created_at timestamptz DEFAULT now()
);

-- 3. checkins
CREATE TABLE public.checkins (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    week_start date NOT NULL,
    dimension text NOT NULL CHECK (dimension IN ('emotional', 'sleep', 'social')),
    response_score integer NOT NULL CHECK (response_score BETWEEN 1 AND 5),
    submitted_at timestamptz DEFAULT now(),
    UNIQUE (student_id, week_start, dimension)
);

-- 4. wellness_signals
CREATE TABLE public.wellness_signals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    academic_status text CHECK (academic_status IN ('good', 'attention', 'risk')),
    emotional_status text,
    social_status text,
    academic_last_updated timestamptz,
    emotional_last_updated timestamptz,
    social_last_updated timestamptz,
    calculated_at timestamptz DEFAULT now()
);

-- 5. flags
CREATE TABLE public.flags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    risk_level text NOT NULL CHECK (risk_level IN ('watch', 'medium', 'high')),
    triggered_dimensions text[],
    weeks_flagged integer DEFAULT 1,
    status text NOT NULL CHECK (status IN ('unassigned', 'assigned', 'ongoing', 'resolved', 'escalated')),
    resolved_note text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 6. counsellor_assignments
CREATE TABLE public.counsellor_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    flag_id uuid NOT NULL REFERENCES public.flags(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    counsellor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    manager_note text,
    status text NOT NULL CHECK (status IN ('pending_contact', 'contacted', 'ongoing', 'resolved', 'escalated')),
    assigned_at timestamptz DEFAULT now(),
    first_contact_at timestamptz,
    resolved_at timestamptz,
    resolution_note text
);

-- 7. counsellor_profiles
CREATE TABLE public.counsellor_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    counsellor_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    specialisation_tags text[],
    personality_description text,
    capacity_limit integer DEFAULT 10,
    is_on_leave boolean DEFAULT false
);

-- 8. profile_edit_requests
CREATE TABLE public.profile_edit_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    counsellor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    requested_changes jsonb NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at timestamptz DEFAULT now()
);

-- 9. chatbot_sessions
CREATE TABLE public.chatbot_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    started_at timestamptz DEFAULT now(),
    ended_at timestamptz,
    escalation_level integer CHECK (escalation_level IN (1, 2, 3)),
    student_shared boolean DEFAULT false,
    shared_summary text
);

-- 10. chatbot_messages
CREATE TABLE public.chatbot_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES public.chatbot_sessions(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('user', 'assistant')),
    content text NOT NULL,
    sent_at timestamptz DEFAULT now()
);

-- 11. social_spaces
CREATE TABLE public.social_spaces (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    name text NOT NULL,
    tags text[],
    branch text,
    semester integer,
    created_at timestamptz DEFAULT now()
);

-- 12. social_posts
CREATE TABLE public.social_posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    space_id uuid NOT NULL REFERENCES public.social_spaces(id) ON DELETE CASCADE,
    author_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content text NOT NULL,
    is_flagged boolean DEFAULT false,
    flagged_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now()
);

-- 13. audit_logs
CREATE TABLE public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    actor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    action text NOT NULL,
    target_id uuid,
    metadata jsonb,
    created_at timestamptz DEFAULT now()
);

-- 14. notifications
CREATE TABLE public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    message text NOT NULL,
    type text NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    read_at timestamptz
);

-- Indexes
CREATE INDEX idx_users_tenant_role ON public.users(tenant_id, role);
CREATE INDEX idx_checkins_student_week ON public.checkins(student_id, week_start);
CREATE INDEX idx_flags_tenant_status ON public.flags(tenant_id, status);
CREATE INDEX idx_counsellor_assignments_counsellor_status ON public.counsellor_assignments(counsellor_id, status);
CREATE INDEX idx_profile_edit_requests_tenant_status ON public.profile_edit_requests(tenant_id, status, created_at);
CREATE INDEX idx_audit_logs_tenant_created ON public.audit_logs(tenant_id, created_at);
CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, is_read);

-- Enable RLS
ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counsellor_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counsellor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_edit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- colleges: Anyone authenticated can read colleges (needed for signup/reference)
CREATE POLICY "Colleges are viewable by authenticated users" ON public.colleges FOR SELECT TO authenticated USING (true);

-- users
CREATE POLICY "Users can read own row" ON public.users FOR SELECT USING (id = auth.uid());
CREATE POLICY "Managers can read all users in tenant" ON public.users FOR SELECT USING (get_auth_user_role() = 'manager' AND tenant_id = get_auth_user_tenant());
CREATE POLICY "Counsellors can read assigned students" ON public.users FOR SELECT USING (get_auth_user_role() = 'counsellor' AND tenant_id = get_auth_user_tenant() AND id IN (SELECT student_id FROM public.counsellor_assignments WHERE counsellor_id = auth.uid()));
CREATE POLICY "Users can update own row" ON public.users FOR UPDATE USING (id = auth.uid());

-- checkins
CREATE POLICY "Students read/write own checkins" ON public.checkins FOR ALL USING (student_id = auth.uid() AND tenant_id = get_auth_user_tenant());
CREATE POLICY "Managers read all checkins in tenant" ON public.checkins FOR SELECT USING (get_auth_user_role() = 'manager' AND tenant_id = get_auth_user_tenant());
CREATE POLICY "Counsellors read assigned student checkins" ON public.checkins FOR SELECT USING (get_auth_user_role() = 'counsellor' AND tenant_id = get_auth_user_tenant() AND student_id IN (SELECT student_id FROM public.counsellor_assignments WHERE counsellor_id = auth.uid()));

-- wellness_signals
CREATE POLICY "Students read own wellness_signals" ON public.wellness_signals FOR SELECT USING (student_id = auth.uid() AND tenant_id = get_auth_user_tenant());
CREATE POLICY "Managers read all wellness_signals in tenant" ON public.wellness_signals FOR SELECT USING (get_auth_user_role() = 'manager' AND tenant_id = get_auth_user_tenant());
CREATE POLICY "Counsellors read assigned student wellness_signals" ON public.wellness_signals FOR SELECT USING (get_auth_user_role() = 'counsellor' AND tenant_id = get_auth_user_tenant() AND student_id IN (SELECT student_id FROM public.counsellor_assignments WHERE counsellor_id = auth.uid()));

-- flags
CREATE POLICY "Students read own flags" ON public.flags FOR SELECT USING (student_id = auth.uid() AND tenant_id = get_auth_user_tenant());
CREATE POLICY "Managers read all flags in tenant" ON public.flags FOR SELECT USING (get_auth_user_role() = 'manager' AND tenant_id = get_auth_user_tenant());
CREATE POLICY "Counsellors read assigned student flags" ON public.flags FOR SELECT USING (get_auth_user_role() = 'counsellor' AND tenant_id = get_auth_user_tenant() AND student_id IN (SELECT student_id FROM public.counsellor_assignments WHERE counsellor_id = auth.uid()));

-- counsellor_assignments
CREATE POLICY "Students read own assignments" ON public.counsellor_assignments FOR SELECT USING (student_id = auth.uid() AND tenant_id = get_auth_user_tenant());
CREATE POLICY "Managers read all assignments in tenant" ON public.counsellor_assignments FOR SELECT USING (get_auth_user_role() = 'manager' AND tenant_id = get_auth_user_tenant());
CREATE POLICY "Counsellors read own assignments" ON public.counsellor_assignments FOR SELECT USING (counsellor_id = auth.uid() AND tenant_id = get_auth_user_tenant());

-- counsellor_profiles
CREATE POLICY "All users in tenant can read counsellor profiles" ON public.counsellor_profiles FOR SELECT USING (tenant_id = get_auth_user_tenant());
CREATE POLICY "Counsellors update own profile" ON public.counsellor_profiles FOR UPDATE USING (counsellor_id = auth.uid());

-- profile_edit_requests
CREATE POLICY "Counsellors create own profile edit requests" ON public.profile_edit_requests FOR INSERT WITH CHECK (counsellor_id = auth.uid() AND tenant_id = get_auth_user_tenant());
CREATE POLICY "Counsellors read own profile edit requests" ON public.profile_edit_requests FOR SELECT USING (counsellor_id = auth.uid() AND tenant_id = get_auth_user_tenant());
CREATE POLICY "Managers read all profile edit requests in tenant" ON public.profile_edit_requests FOR SELECT USING (get_auth_user_role() = 'manager' AND tenant_id = get_auth_user_tenant());
CREATE POLICY "Managers update profile edit requests in tenant" ON public.profile_edit_requests FOR UPDATE USING (get_auth_user_role() = 'manager' AND tenant_id = get_auth_user_tenant());

-- chatbot_sessions
CREATE POLICY "Students read/write own sessions" ON public.chatbot_sessions FOR ALL USING (student_id = auth.uid() AND tenant_id = get_auth_user_tenant());
CREATE POLICY "Managers read all sessions in tenant" ON public.chatbot_sessions FOR SELECT USING (get_auth_user_role() = 'manager' AND tenant_id = get_auth_user_tenant());

-- chatbot_messages
CREATE POLICY "Students read/write own messages" ON public.chatbot_messages FOR ALL USING (tenant_id = get_auth_user_tenant() AND session_id IN (SELECT id FROM public.chatbot_sessions WHERE student_id = auth.uid()));
CREATE POLICY "Managers read all messages in tenant" ON public.chatbot_messages FOR SELECT USING (get_auth_user_role() = 'manager' AND tenant_id = get_auth_user_tenant());

-- social_spaces
CREATE POLICY "All users in tenant can read social spaces" ON public.social_spaces FOR SELECT USING (tenant_id = get_auth_user_tenant());

-- social_posts
CREATE POLICY "All users in tenant can read posts" ON public.social_posts FOR SELECT USING (tenant_id = get_auth_user_tenant());
CREATE POLICY "Students create own posts" ON public.social_posts FOR INSERT WITH CHECK (author_id = auth.uid() AND tenant_id = get_auth_user_tenant());
CREATE POLICY "Managers read/write all posts" ON public.social_posts FOR ALL USING (get_auth_user_role() = 'manager' AND tenant_id = get_auth_user_tenant());

-- audit_logs
CREATE POLICY "Managers read all audit logs in tenant" ON public.audit_logs FOR SELECT USING (get_auth_user_role() = 'manager' AND tenant_id = get_auth_user_tenant());

-- notifications
CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────────────────────
-- Live-deployment additions
--
-- These columns and tables were added against the live database during
-- iterative development and are now considered part of the baseline schema.
-- Everything below is additive, idempotent, and safe to re-run. Newer features
-- continue to live as numbered migrations under migrations/.
-- ────────────────────────────────────────────────────────────────────────────

-- wellness_signals: per-dimension score + suggestion + updated_at
ALTER TABLE public.wellness_signals
  ADD COLUMN IF NOT EXISTS academic_score integer,
  ADD COLUMN IF NOT EXISTS emotional_score integer,
  ADD COLUMN IF NOT EXISTS social_score integer,
  ADD COLUMN IF NOT EXISTS academic_suggestion text,
  ADD COLUMN IF NOT EXISTS emotional_suggestion text,
  ADD COLUMN IF NOT EXISTS social_suggestion text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- lms_data: current academic state per student (Newton sync target)
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

-- newton_credentials: encrypted Newton token per student
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

DROP POLICY IF EXISTS "Managers read newton sync status" ON public.newton_credentials;
CREATE POLICY "Managers read newton sync status"
  ON public.newton_credentials FOR SELECT
  USING (get_auth_user_role() = 'manager' AND tenant_id = get_auth_user_tenant());

-- user_preferences: weekly check-in cadence, delivery channel, language
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
