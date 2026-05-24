// SECURITY: using Supabase client — parameterized queries, no raw SQL concatenation
import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { validateBody } from '../middleware/validateBody';
import { loginLimiter } from '../middleware/rateLimiters';
import { emptyBodySchema, loginSchema, activateSchema } from '../validators/auth.validators';
import { activationLimiter } from '../middleware/rateLimiters';
import { logger } from '../lib/logger';

const router = Router();

router.post('/login', loginLimiter, validateBody(loginSchema), async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.session) {
      logger.warn({ email, ip: req.ip }, 'Failed login attempt');
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = authData.session.access_token;
    const userId = authData.user.id;

    // Fetch user profile and preferences
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, tenant_id, role, full_name, is_active')
      .eq('id', userId)
      .single();

    const { data: prefData } = await supabase
      .from('user_preferences')
      .select('onboarding_complete')
      .eq('student_id', userId)
      .single();

    if (userError || !userData) {
      res.status(401).json({ error: 'User profile not found' });
      return;
    }

    if (!userData.is_active) {
      res.status(403).json({ error: 'User account is disabled' });
      return;
    }

    // Return restricted payload
    res.json({
      token,
      user: {
        id: userData.id,
        tenant_id: userData.tenant_id,
        role: userData.role,
        full_name: userData.full_name,
        onboarding_complete: prefData?.onboarding_complete || false,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Login error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', authMiddleware, validateBody(emptyBodySchema), async (req: Request, res: Response): Promise<void> => {
  try {
    // In a proxy scenario with persistSession: false, 
    // the global session isn't persisted for the backend to sign out of.
    // However, calling admin.signOut with the JWT can invalidate it if needed,
    // but the Supabase client handles admin.signOut(jwt) primarily for session revocation globally.
    // Since we rely on the JWT expiry and client-side deletion, we can just acknowledge the logout.
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    logger.error({ err: error }, 'Logout error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  const { data: prefData } = await supabase
    .from('user_preferences')
    .select('onboarding_complete')
    .eq('student_id', req.user!.id)
    .single();

  res.json({
    user: {
      ...req.user,
      onboarding_complete: prefData?.onboarding_complete || false,
    }
  });
});

// ─── ACTIVATION ENDPOINTS (public — no auth required) ────────────────────────

router.get('/activate', activationLimiter, async (req: Request, res: Response): Promise<void> => {
  const token = req.query.token as string;

  if (!token) {
    res.status(400).json({ valid: false, reason: 'not_found' });
    return;
  }

  const { data: invite, error } = await supabase
    .from('student_invites')
    .select('id, email, full_name, tenant_id, batch, semester, status, expires_at')
    .eq('invite_token', token)
    .maybeSingle();

  if (error || !invite) {
    res.json({ valid: false, reason: 'not_found' });
    return;
  }

  if (invite.status === 'activated') {
    res.json({ valid: false, reason: 'already_used' });
    return;
  }

  if (new Date(invite.expires_at) < new Date()) {
    res.json({ valid: false, reason: 'expired' });
    return;
  }

  if (!['pending', 'resent'].includes(invite.status)) {
    res.json({ valid: false, reason: 'expired' });
    return;
  }

  res.json({
    valid: true,
    email: invite.email,
    full_name: invite.full_name,
    tenant_id: invite.tenant_id,
    batch: invite.batch,
    semester: invite.semester,
  });
});

router.post('/activate', activationLimiter, validateBody(activateSchema), async (req: Request, res: Response): Promise<void> => {
  const { token, password } = req.body;

  try {
    const { data: invite, error: inviteErr } = await supabase
      .from('student_invites')
      .select('id, email, full_name, tenant_id, batch, semester, status, expires_at, auth_user_id')
      .eq('invite_token', token)
      .maybeSingle();

    if (inviteErr || !invite) {
      res.status(400).json({ error: 'Invalid activation token' });
      return;
    }

    if (invite.status === 'activated') {
      res.status(400).json({ error: 'This account has already been activated' });
      return;
    }

    if (new Date(invite.expires_at) < new Date()) {
      res.status(400).json({ error: 'This activation link has expired. Please ask your administrator to resend the invite.' });
      return;
    }

    if (!['pending', 'resent'].includes(invite.status)) {
      res.status(400).json({ error: 'This activation link is no longer valid' });
      return;
    }

    if (!invite.auth_user_id) {
      res.status(500).json({ error: 'Account setup error. Please contact your administrator.' });
      return;
    }

    // Update Supabase Auth user password
    const { error: passwordErr } = await supabase.auth.admin.updateUserById(invite.auth_user_id, {
      password,
    });

    if (passwordErr) {
      logger.error({ err: passwordErr }, 'Failed to set activation password');
      res.status(500).json({ error: 'Failed to set password. Please try again.' });
      return;
    }

    // Activate the user
    await supabase
      .from('users')
      .update({ is_active: true })
      .eq('id', invite.auth_user_id);

    // Create user_preferences with defaults
    await supabase.from('user_preferences').upsert({
      student_id: invite.auth_user_id,
      onboarding_complete: false,
    }, { onConflict: 'student_id' });

    // Mark invite as activated
    await supabase
      .from('student_invites')
      .update({ status: 'activated', activated_at: new Date().toISOString() })
      .eq('id', invite.id);

    await supabase.from('audit_logs').insert({
      tenant_id: invite.tenant_id,
      actor_id: invite.auth_user_id,
      action: 'student_activated',
    });

    res.json({ activated: true, role: 'student' });
  } catch (err: any) {
    logger.error({ err }, 'Activation error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
