// SECURITY: using Supabase client — parameterized queries, no raw SQL concatenation
import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { getTenantId } from '../utils/tenant';
import { logger } from '../lib/logger';

const router = Router();

// Get notifications: last 20 unread + last 10 read
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.user!.id;

    // 1. Get last 20 unread
    const { data: unread, error: unreadErr } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(20);

    if (unreadErr) {
      logger.error({ err: unreadErr, userId }, 'Failed to fetch unread notifications');
      res.status(500).json({ error: 'Failed to fetch notifications' });
      return;
    }

    // 2. Get last 10 read
    const { data: read, error: readErr } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('is_read', true)
      .order('created_at', { ascending: false })
      .limit(10);

    if (readErr) {
      logger.error({ err: readErr, userId }, 'Failed to fetch read notifications');
      res.status(500).json({ error: 'Failed to fetch notifications' });
      return;
    }

    res.json({
      unread: unread || [],
      read: read || []
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Get unread notification count
router.get('/unread-count', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.user!.id;

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('is_read', false);

    if (error) {
      logger.error({ err: error, userId }, 'Failed to fetch unread count');
      res.status(500).json({ error: 'Failed to fetch unread count' });
      return;
    }

    res.json({ count: count || 0 });
  } catch (err: any) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Mark specific notification as read
router.patch('/:id/read', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.user!.id;
    const notificationId = req.params.id;

    const { error } = await supabase
      .from('notifications')
      .update({ 
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', notificationId)
      .eq('user_id', userId)
      .eq('tenant_id', tenantId);

    if (error) {
      logger.error({ err: error, notificationId }, 'Failed to mark notification as read');
      res.status(500).json({ error: 'Failed to mark as read' });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Mark all notifications as read
router.patch('/read-all', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.user!.id;

    const { error } = await supabase
      .from('notifications')
      .update({ 
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('is_read', false);

    if (error) {
      logger.error({ err: error, userId }, 'Failed to mark all notifications as read');
      res.status(500).json({ error: 'Failed to mark all as read' });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

export default router;
