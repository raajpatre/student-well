// SECURITY: using Supabase client — parameterized queries, no raw SQL concatenation
import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { getTenantId } from '../utils/tenant';
import { validateBody } from '../middleware/validateBody';
import { createSpacePostSchema, flagSpacePostSchema } from '../validators/spaces.validators';

const router = Router();

/* ─────────────────────────────────────────
   GET /api/spaces
───────────────────────────────────────── */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.user!.id;

    // Get student's interest tags
    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('interest_tags')
      .eq('student_id', userId)
      .eq('tenant_id', tenantId)
      .single();

    const studentTags: string[] = prefs?.interest_tags || [];

    const { data: spaces, error } = await supabase
      .from('social_spaces')
      .select('id, name, description, tags, member_count, is_active')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('member_count', { ascending: false });

    if (error) {
      res.status(500).json({ error: 'Failed to fetch spaces' });
      return;
    }

    // Prioritise matching tags
    const sorted = (spaces || []).sort((a, b) => {
      const aMatch = (a.tags || []).some((t: string) => studentTags.includes(t)) ? -1 : 0;
      const bMatch = (b.tags || []).some((t: string) => studentTags.includes(t)) ? -1 : 0;
      return aMatch - bMatch;
    });

    res.json({ spaces: sorted });
  } catch (err: any) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

/* ─────────────────────────────────────────
   GET /api/spaces/:space_id/posts
───────────────────────────────────────── */
router.get('/:space_id/posts', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const { space_id } = req.params;

    const { data: posts, error } = await supabase
      .from('social_posts')
      .select('id, content, created_at, author_name')
      .eq('space_id', space_id)
      .eq('tenant_id', tenantId)
      .eq('is_flagged', false)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      res.status(500).json({ error: 'Failed to fetch posts' });
      return;
    }

    res.json({ posts: posts || [] });
  } catch (err: any) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

/* ─────────────────────────────────────────
   POST /api/spaces/:space_id/posts
───────────────────────────────────────── */
router.post('/:space_id/posts', validateBody(createSpacePostSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.user!.id;
    const { space_id } = req.params;
    const { content } = req.body;

    // Get first name for display
    const { data: user } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', userId)
      .single();
    const authorName = user?.full_name?.split(' ')[0] || 'Student';

    const { data: post, error } = await supabase
      .from('social_posts')
      .insert({
        space_id,
        tenant_id: tenantId,
        author_id: userId,
        author_name: authorName,
        content: content.trim(),
        is_flagged: false,
      })
      .select('id, content, created_at, author_name')
      .single();

    if (error) {
      res.status(500).json({ error: 'Failed to create post' });
      return;
    }

    // member_count increment handled by a DB trigger or admin task

    res.json({ post });
  } catch (err: any) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

/* ─────────────────────────────────────────
   POST /api/spaces/:space_id/posts/:post_id/flag
   Uses social_posts.flagged_by + is_flagged
───────────────────────────────────────── */
router.post('/:space_id/posts/:post_id/flag', validateBody(flagSpacePostSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.user!.id;
    const { post_id } = req.params;

    await supabase
      .from('social_posts')
      .update({ is_flagged: true, flagged_by: userId })
      .eq('id', post_id)
      .eq('tenant_id', tenantId);

    try {
      await supabase.from('audit_logs').insert({
        tenant_id: tenantId,
        actor_id: userId,
        action: 'flag_space_post',
        target_id: post_id,
      });
    } catch { /* non-critical */ }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

export default router;
