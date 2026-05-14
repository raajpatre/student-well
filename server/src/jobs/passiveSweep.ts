// SECURITY: using Supabase client — parameterized queries, no raw SQL concatenation
import cron from 'node-cron';
import { supabase } from '../lib/supabase';
import { updateWellnessSignals } from '../services/wellnessCalculator';
import { logger } from '../lib/logger';

export const sweepPassiveData = async () => {
  logger.info('Passive signal sweep starting');
  
  try {
    const { data: students, error: stdErr } = await supabase
      .from('users')
      .select('id, tenant_id')
      .eq('role', 'student')
      .eq('is_active', true);

    if (stdErr || !students) {
      logger.error({ err: stdErr }, 'Failed to fetch active students for passive sweep');
      return;
    }

    logger.info({ studentCount: students.length }, 'Evaluating students for passive sweep');

    let evaluatedCount = 0;

    for (const student of students) {
      await updateWellnessSignals(student.id, student.tenant_id);
      evaluatedCount++;
    }

    // Try to get a system/manager user per tenant to log the action
    const tenantIds = new Set(students.map(s => s.tenant_id));
    for (const tId of tenantIds) {
      const { data: managers } = await supabase.from('users').select('id').eq('role', 'manager').eq('tenant_id', tId).limit(1);
      if (managers && managers.length > 0) {
        const { error: logErr } = await supabase.from('audit_logs').insert({
          tenant_id: tId,
          actor_id: managers[0].id,
          action: 'cron_passive_sweep',
          metadata: { evaluated_count: students.filter(s => s.tenant_id === tId).length }
        });
        if (logErr) {
          logger.error({ err: logErr, tenantId: tId }, 'Failed to log passive sweep to audit_logs');
        }
      }
    }

    logger.info({ evaluatedCount }, 'Passive signal sweep completed');
  } catch (error) {
    logger.error({ err: error }, 'Unexpected passive sweep error');
  }
};

export const startPassiveSweepJob = () => {
  // Schedule to run every Monday at 6:00 AM
  cron.schedule('0 6 * * 1', sweepPassiveData, {
    timezone: "Asia/Kolkata"
  });
};
