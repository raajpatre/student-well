// SECURITY: using Supabase client — parameterized queries, no raw SQL concatenation
import { Request, Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

// ── Token cache ────────────────────────────────────────────────────────────
// Cache validated user profiles for 30 seconds to avoid hammering Supabase
// auth.getUser() on every request and hitting rate limits under load.
interface CachedUser {
  id: string;
  tenant_id: string;
  role: string;
  full_name: string;
  expiresAt: number;
}
const TOKEN_CACHE = new Map<string, CachedUser>();
const CACHE_TTL_MS = 30_000;

function getCachedUser(token: string): CachedUser | null {
  const cached = TOKEN_CACHE.get(token);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    TOKEN_CACHE.delete(token);
    return null;
  }
  return cached;
}

function cacheUser(token: string, user: Omit<CachedUser, 'expiresAt'>): void {
  TOKEN_CACHE.set(token, { ...user, expiresAt: Date.now() + CACHE_TTL_MS });
  // Prune stale entries when cache grows large
  if (TOKEN_CACHE.size > 1000) {
    const now = Date.now();
    for (const [k, v] of TOKEN_CACHE) {
      if (now > v.expiresAt) TOKEN_CACHE.delete(k);
    }
  }
}
// ──────────────────────────────────────────────────────────────────────────

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid authorization header' });
      return;
    }

    const token = authHeader.split(' ')[1];

    // Fast path: return cached profile if still valid
    const cached = getCachedUser(token);
    if (cached) {
      req.user = { id: cached.id, tenant_id: cached.tenant_id, role: cached.role, full_name: cached.full_name };
      next();
      return;
    }

    // Verify token with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authData.user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // Fetch user details from our public.users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, tenant_id, role, full_name, is_active')
      .eq('id', authData.user.id)
      .single();

    if (userError || !userData) {
      res.status(401).json({ error: 'User profile not found' });
      return;
    }

    if (!userData.is_active) {
      res.status(403).json({ error: 'User account is disabled' });
      return;
    }

    // Attach user to req and cache for subsequent requests
    req.user = {
      id: userData.id,
      tenant_id: userData.tenant_id,
      role: userData.role,
      full_name: userData.full_name,
    };
    cacheUser(token, req.user);

    next();
  } catch (err) {
    logger.error({ err }, 'Auth middleware error');
    res.status(500).json({ error: 'Internal server error' });
  }
};
