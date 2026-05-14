// SECURITY: using Supabase client — parameterized queries, no raw SQL concatenation
import cron from 'node-cron';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { notify, notifyManagers } from '../services/notificationService';

// 1. Daily Manager Digest (9:00 AM)
export const runDailyDigest = async () => {
  logger.info('Running Daily Manager Digest');
  try {
    const { data: colleges } = await supabase.from('colleges').select('id');
    if (!colleges) return;

    for (const college of colleges) {
      const tenantId = college.id;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      // New high-risk flags since yesterday
      const { count: newFlags } = await supabase
        .from('flags')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('risk_level', 'high')
        .gte('created_at', yesterday.toISOString());

      // Total pending assignments
      const { count: pendingCount } = await supabase
        .from('counsellor_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'pending_contact');

      if ((newFlags || 0) > 0 || (pendingCount || 0) > 0) {
        const msg = `Daily Digest: ${newFlags || 0} new high-risk flags since yesterday. Total ${pendingCount || 0} students pending counsellor contact.`;
        await notifyManagers(tenantId, msg, 'daily_digest', 'whatsapp');
      }
    }
  } catch (error) {
    logger.error({ err: error }, 'Daily digest job failed');
  }
};

// 2. Weekly Student Check-in (Monday 9:00 AM)
export const runWeeklyCheckin = async () => {
  logger.info('Running Weekly Student Check-in');
  try {
    const { data: students } = await supabase
      .from('users')
      .select('id, full_name, tenant_id')
      .eq('role', 'student')
      .eq('is_active', true);

    if (!students) return;

    for (const student of students) {
      const firstName = student.full_name.split(' ')[0];
      const message = `Hey ${firstName} 👋 Quick check-in time — one question, takes 10 seconds. https://studentwell.com/check-in`;
      await notify(student.id, student.tenant_id, message, 'check_in', 'whatsapp');
    }
  } catch (error) {
    logger.error({ err: error }, 'Weekly check-in job failed');
  }
};

// 3. Assignment Nudges (> 3 days pending)
export const runAssignmentNudges = async () => {
  logger.info('Running Assignment Nudges');
  try {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];

    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    const fiveDaysAgoStr = fiveDaysAgo.toISOString().split('T')[0];

    const { data: assignments } = await supabase
      .from('counsellor_assignments')
      .select('id, counsellor_id, tenant_id, created_at')
      .eq('status', 'pending_contact');

    if (!assignments) return;

    for (const item of assignments) {
      const createdAtStr = new Date(item.created_at).toISOString().split('T')[0];
      
      if (createdAtStr === threeDaysAgoStr || createdAtStr === fiveDaysAgoStr) {
        await notify(
          item.counsellor_id,
          item.tenant_id,
          'NUDGE: A student has been assigned to you. Please review the flag and initiate contact.',
          'assignment',
          'both'
        );
      }
    }
  } catch (error) {
    logger.error({ err: error }, 'Assignment nudge job failed');
  }
};

// 4. Overdue First Contact (> 5 days) -> Manager Alert
export const runOverdueContactAlerts = async () => {
  logger.info('Running Overdue Contact Alerts');
  try {
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const { data: overdue } = await supabase
      .from('counsellor_assignments')
      .select('id, tenant_id, counsellor_id')
      .eq('status', 'pending_contact')
      .lte('created_at', fiveDaysAgo.toISOString());

    if (!overdue) return;

    // We notify managers about these overdue items
    for (const item of overdue) {
      await notifyManagers(
        item.tenant_id,
        `URGENT: Student assignment (ID: ${item.id}) has been pending for over 5 days without contact from the counsellor.`,
        'escalation',
        'whatsapp'
      );
    }
  } catch (error) {
    logger.error({ err: error }, 'Overdue contact job failed');
  }
};

// Initialize all jobs
export const initNotificationJobs = () => {
  // Daily Digest at 9:00 AM
  cron.schedule('0 9 * * *', runDailyDigest, { timezone: 'Asia/Kolkata' });

  // Weekly Check-in on Monday at 9:00 AM
  cron.schedule('0 9 * * 1', runWeeklyCheckin, { timezone: 'Asia/Kolkata' });

  // Nudges and Overdue alerts (run daily at 10:00 AM)
  cron.schedule('0 10 * * *', async () => {
    await runAssignmentNudges();
    await runOverdueContactAlerts();
  }, { timezone: 'Asia/Kolkata' });
};
