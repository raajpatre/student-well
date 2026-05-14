// SECURITY: using Supabase client — parameterized queries, no raw SQL concatenation
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

export const flagEvaluation = async (studentId: string, tenantId: string): Promise<void> => {
  try {
    // Get the current wellness signals for the student
    const { data: signals, error: sigErr } = await supabase
      .from('wellness_signals')
      .select('*')
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .single();

    if (sigErr || !signals) {
      logger.error({ err: sigErr, studentId }, 'Failed to fetch wellness signals for flag evaluation');
      return;
    }

    const { academic_status, emotional_status, social_status } = signals;
    
    // Count risk and attention levels
    let riskCount = 0;
    let attentionCount = 0;
    const triggeredDimensions: string[] = [];

    const checkStatus = (status: string | null, dimension: string) => {
      if (status === 'risk') {
        riskCount++;
        triggeredDimensions.push(dimension);
      } else if (status === 'attention') {
        attentionCount++;
        triggeredDimensions.push(dimension);
      }
    };

    checkStatus(academic_status, 'academic');
    checkStatus(emotional_status, 'emotional');
    checkStatus(social_status, 'social');

    let newRiskLevel: 'high' | 'medium' | 'watch' | null = null;

    if (riskCount >= 2) {
      newRiskLevel = 'high';
    } else if (riskCount === 1 || attentionCount >= 2) {
      newRiskLevel = 'medium';
    } else if (attentionCount === 1) {
      newRiskLevel = 'watch';
    }

    // Check for existing flag
    const { data: existingFlags } = await supabase
      .from('flags')
      .select('*')
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .in('status', ['unassigned', 'assigned', 'ongoing', 'escalated'])
      .order('created_at', { ascending: false });

    const activeFlag = existingFlags && existingFlags.length > 0 ? existingFlags[0] : null;

    if (newRiskLevel) {
      if (activeFlag) {
        // Update existing flag
        await supabase
          .from('flags')
          .update({
            risk_level: newRiskLevel,
            triggered_dimensions: triggeredDimensions,
            updated_at: new Date().toISOString()
          })
          .eq('id', activeFlag.id);
      } else {
        // Create new flag
        const { data: newFlag, error: newFlagErr } = await supabase
          .from('flags')
          .insert({
            tenant_id: tenantId,
            student_id: studentId,
            risk_level: newRiskLevel,
            triggered_dimensions: triggeredDimensions,
            status: 'unassigned'
          })
          .select()
          .single();

        if (newFlag && newRiskLevel === 'high') {
          // Audit log for high-risk flag creation
          await supabase.from('audit_logs').insert({
            tenant_id: tenantId,
            actor_id: studentId, // System essentially acting on behalf of student data
            action: 'high_risk_flag_created',
            target_id: newFlag.id,
            metadata: { triggered_dimensions: triggeredDimensions }
          });
          
          // TODO: Trigger manager notification
          logger.warn({ studentId, flagId: newFlag.id }, 'Mock high risk flag notification');
        }
      }
    } else {
      // All good. Resolve unassigned flags if they exist.
      if (activeFlag && activeFlag.status === 'unassigned') {
        await supabase
          .from('flags')
          .update({
            status: 'resolved',
            resolved_note: 'Auto-resolved: wellness signals returned to good',
            updated_at: new Date().toISOString()
          })
          .eq('id', activeFlag.id);
          
        await supabase.from('audit_logs').insert({
            tenant_id: tenantId,
            actor_id: studentId,
            action: 'flag_auto_resolved',
            target_id: activeFlag.id
          });
      }
    }

  } catch (error) {
    logger.error({ err: error, studentId }, 'Error in flag evaluation');
  }
};
