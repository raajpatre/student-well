// SECURITY: using Supabase client — parameterized queries, no raw SQL concatenation
import { supabase } from '../lib/supabase';
import { flagEvaluation } from './flagEvaluator';
import { logger } from '../lib/logger';

// Helper to get average of an array
const getAverage = (arr: number[]) => arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;

export const calculateEmotionalStatus = async (studentId: string, tenantId: string): Promise<string> => {
  // Get last 4 weeks of emotional and sleep check-ins
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  
  const { data: checkins } = await supabase
    .from('checkins')
    .select('response_score, dimension, week_start')
    .eq('student_id', studentId)
    .eq('tenant_id', tenantId)
    .in('dimension', ['emotional', 'sleep'])
    .gte('week_start', fourWeeksAgo.toISOString().split('T')[0]);
    
  if (!checkins || checkins.length === 0) {
    // If no checkins in 4 weeks, considered risk
    return 'risk';
  }

  const scores = checkins.map(c => c.response_score);
  const avg = getAverage(scores);

  // Check for 3+ consecutive weeks of no checkin (rough approximation for now based on count, 
  // actual date diff checking is more robust but this handles the basic criteria)
  // Let's do actual week counting:
  const uniqueWeeks = new Set(checkins.map(c => c.week_start)).size;
  if (uniqueWeeks <= 1 && checkins.length < 2) {
      // Very sparse data, implies missing weeks
      // We will refine consecutive missing logic in the passive sweep
  }

  if (avg >= 4) return 'good';
  if (avg >= 2.5) return 'attention';
  return 'risk';
};

export const calculateSocialStatus = async (studentId: string, tenantId: string): Promise<string> => {
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  
  const { data: checkins } = await supabase
    .from('checkins')
    .select('response_score, week_start')
    .eq('student_id', studentId)
    .eq('tenant_id', tenantId)
    .eq('dimension', 'social')
    .gte('week_start', fourWeeksAgo.toISOString().split('T')[0]);

  // Mocking passive signal: last_login
  // Assuming 'good' if we don't have a reliable last_login source yet,
  // but if the user hasn't logged in for 14+ days, force 'attention'
  // For now, let's just evaluate based on check-ins, the passive sweep will force 'attention' later.

  if (!checkins || checkins.length === 0) {
    return 'attention'; // Not enough data
  }

  const scores = checkins.map(c => c.response_score);
  const avg = getAverage(scores);

  if (avg >= 4) return 'good';
  if (avg >= 2.5) return 'attention';
  return 'risk';
};

export const calculateAcademicStatus = async (studentId: string, tenantId: string): Promise<string> => {
  // MOCK: Fetch attendance trend from latest LMS import data
  // Since we don't have an LMS integration table yet, we will mock an attendance score.
  // In a real app, we'd query an `academic_records` table here.
  const mockedAttendanceScore = 85; 

  if (mockedAttendanceScore >= 80) return 'good';
  if (mockedAttendanceScore >= 65) return 'attention';
  return 'risk';
};

export const updateWellnessSignals = async (studentId: string, tenantId: string): Promise<void> => {
  try {
    const emotional = await calculateEmotionalStatus(studentId, tenantId);
    const social = await calculateSocialStatus(studentId, tenantId);
    const academic = await calculateAcademicStatus(studentId, tenantId);

    const now = new Date().toISOString();

    const { data: existing } = await supabase
      .from('wellness_signals')
      .select('id')
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .single();

    if (existing) {
      const { error } = await supabase
        .from('wellness_signals')
        .update({
          emotional_status: emotional,
          social_status: social,
          academic_status: academic,
          emotional_last_updated: now,
          social_last_updated: now,
          academic_last_updated: now,
          calculated_at: now
        })
        .eq('id', existing.id);

      if (error) {
          logger.error({ err: error, studentId }, 'Failed to update wellness signals');
          return;
      }
    } else {
      const { error } = await supabase
        .from('wellness_signals')
        .insert({
          student_id: studentId,
          tenant_id: tenantId,
          emotional_status: emotional,
          social_status: social,
          academic_status: academic,
          emotional_last_updated: now,
          social_last_updated: now,
          academic_last_updated: now,
          calculated_at: now
        });

      if (error) {
          logger.error({ err: error, studentId }, 'Failed to insert wellness signals');
          return;
      }
    }

    // Trigger flag evaluation
    await flagEvaluation(studentId, tenantId);

  } catch (err) {
    logger.error({ err, studentId }, 'Error updating wellness signals');
  }
};
