// SECURITY: using Supabase client — parameterized queries, no raw SQL concatenation
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { logger } from './lib/logger';

dotenv.config();

// Since we are mocking the request object, we will test the services directly
import { getChatModel } from './services/geminiClient';
import { detectEscalation } from './services/escalationDetector';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function verify() {
  logger.info('--- Starting Chat System Verification (Gemini) ---');

  if (process.env.GEMINI_API_KEY === 'dummy' || !process.env.GEMINI_API_KEY) {
    logger.warn('GEMINI_API_KEY is not set or is "dummy". Gemini API calls will fail.');
  }

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

  // 2. Create a session
  const { data: session, error: sessErr } = await supabase
    .from('chatbot_sessions')
    .insert({
      tenant_id: student.tenant_id,
      student_id: student.id
    })
    .select('id')
    .single();

  if (sessErr || !session) {
    logger.error({ err: sessErr }, 'Failed to create session');
    return;
  }

  logger.info({ sessionId: session.id }, 'Session created successfully');

  const history: any[] = [];
  
  // 3. Test Escalation Detection - Level 2
  logger.info('Testing Escalation Detection (Level 2)');
  const testMsg = "I want to disappear";
  const escLevel = await detectEscalation(testMsg, history, session.id, student.id, student.tenant_id);
  
  if (escLevel === 2) {
    logger.info('Level 2 escalation detected successfully');
  } else {
    logger.error({ escLevel }, 'Failed to detect Level 2 escalation');
  }

  // Check if flag was created
  const { data: flags } = await supabase
    .from('flags')
    .select('*')
    .eq('student_id', student.id)
    .order('created_at', { ascending: false })
    .limit(1);
    
  if (flags && flags.length > 0 && flags[0].risk_level === 'high') {
    logger.info('Level 2 high risk flag created in database');
  } else {
    logger.error('Level 2 high risk flag was not created');
  }

  // 4. Test Gemini Chat Response (Will fail if key is dummy, wrapped in try/catch)
  logger.info('Testing Gemini Chat Generation');
  try {
    const model = getChatModel();
    const chat = model.startChat({ history: [] });
    const result = await chat.sendMessage("I am feeling a little stressed about exams.");
    logger.info({ content: result.response.text() }, 'Gemini response received');
  } catch (error: any) {
    logger.info({ err: error }, 'Gemini generation failed (expected if dummy key)');
  }

  logger.info('--- Verification Complete ---');
}

verify().catch(err => logger.error({ err }, 'Chat verification failed'));
