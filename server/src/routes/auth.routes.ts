// SECURITY: using Supabase client — parameterized queries, no raw SQL concatenation
import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { validateBody } from '../middleware/validateBody';
import { loginLimiter } from '../middleware/rateLimiters';
import { emptyBodySchema, loginSchema } from '../validators/auth.validators';
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

export default router;
