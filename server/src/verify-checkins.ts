// SECURITY: using Supabase client — parameterized queries, no raw SQL concatenation
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { updateWellnessSignals } from './services/wellnessCalculator';
import { logger } from './lib/logger';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

const getWeekStart = (): string => {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
};

async function verify() {
  logger.info('--- Starting Check-in System Verification ---');

  // 1. Find a student
  const { data: students, error: err1 } = await supabase
    .from('users')
    .select('id, tenant_id')
    .eq('role', 'student')
    .limit(1);

  if (err1 || !students || students.length === 0) {
    logger.error({ err: err1 }, 'No students found to test with');
    return;
  }

  const student = students[0];
  const weekStart = getWeekStart();

  // Cleanup past test checkins for this week to have a clean slate
  await supabase.from('checkins').delete().eq('student_id', student.id).eq('week_start', weekStart);

  // 2. Submit a check-in
  logger.info('Testing single check-in submission');
  const { error: insertErr } = await supabase.from('checkins').insert({
    tenant_id: student.tenant_id,
    student_id: student.id,
    week_start: weekStart,
    dimension: 'emotional',
    response_score: 5
  });

  if (insertErr) {
    logger.error({ err: insertErr }, 'Failed to insert check-in');
  } else {
    logger.info('Check-in successfully inserted');
  }

  // 3. Duplicate submission check
  logger.info('Testing duplicate submission');
  const { error: dupErr } = await supabase.from('checkins').insert({
    tenant_id: student.tenant_id,
    student_id: student.id,
    week_start: weekStart,
    dimension: 'emotional',
    response_score: 4
  });

  if (dupErr && dupErr.code === '23505') {
    logger.info('Duplicate check-in blocked by database unique constraint');
  } else {
    logger.error({ err: dupErr }, 'Duplicate check-in was not blocked properly');
  }

  // 4. Submit all 3 at score 1
  logger.info('Simulating all dimensions at score 1');
  await supabase.from('checkins').delete().eq('student_id', student.id).eq('week_start', weekStart);
  
  await supabase.from('checkins').insert([
    { tenant_id: student.tenant_id, student_id: student.id, week_start: weekStart, dimension: 'emotional', response_score: 1 },
    { tenant_id: student.tenant_id, student_id: student.id, week_start: weekStart, dimension: 'sleep', response_score: 1 },
    { tenant_id: student.tenant_id, student_id: student.id, week_start: weekStart, dimension: 'social', response_score: 1 },
  ]);

  // Recalculate wellness manually for testing
  await updateWellnessSignals(student.id, student.tenant_id);

  // Check flag created
  const { data: flags } = await supabase.from('flags').select('*').eq('student_id', student.id).order('created_at', { ascending: false }).limit(1);
  if (flags && flags.length > 0 && flags[0].risk_level === 'high') {
    logger.info({ triggeredDimensions: flags[0].triggered_dimensions }, 'High risk flag created successfully');
  } else {
    logger.error({ flags }, 'High risk flag was not created');
  }

  // 5. Simulate all good scores
  logger.info('Simulating all dimensions at score 5');
  await supabase.from('checkins').delete().eq('student_id', student.id).eq('week_start', weekStart);
  await supabase.from('checkins').insert([
    { tenant_id: student.tenant_id, student_id: student.id, week_start: weekStart, dimension: 'emotional', response_score: 5 },
    { tenant_id: student.tenant_id, student_id: student.id, week_start: weekStart, dimension: 'sleep', response_score: 5 },
    { tenant_id: student.tenant_id, student_id: student.id, week_start: weekStart, dimension: 'social', response_score: 5 },
  ]);

  await updateWellnessSignals(student.id, student.tenant_id);

  const { data: updatedFlags } = await supabase.from('flags').select('*').eq('student_id', student.id).order('updated_at', { ascending: false }).limit(1);
  if (updatedFlags && updatedFlags.length > 0 && updatedFlags[0].status === 'resolved') {
    logger.info('Flag automatically resolved as expected');
  } else {
    logger.error({ updatedFlags }, 'Flag was not resolved');
  }

  logger.info('--- Verification Complete ---');
}

verify().catch(err => logger.error({ err }, 'Check-in verification failed'));
