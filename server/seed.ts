// SECURITY: using Supabase client — parameterized queries, no raw SQL concatenation
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { logger } from './src/lib/logger';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function seed() {
  logger.info('Starting seed');
  
  // 1. Create 2 Colleges
  const { data: colleges, error: cErr } = await supabase
    .from('colleges')
    .upsert([
      { name: 'College A', slug: 'college-a' },
      { name: 'College B', slug: 'college-b' }
    ], { onConflict: 'slug' })
    .select();
    
  if (cErr) {
    logger.error({ err: cErr }, 'Error creating colleges');
    return;
  }
  
  const collegeAId = colleges.find(c => c.slug === 'college-a')!.id;
  const collegeBId = colleges.find(c => c.slug === 'college-b')!.id;
  
  // 2. Create users in auth.users and public.users
  const users = [
    { email: 'student1@collegea.edu', password: 'password123', role: 'student', full_name: 'Student One', tenant_id: collegeAId },
    { email: 'student2@collegeb.edu', password: 'password123', role: 'student', full_name: 'Student Two', tenant_id: collegeBId },
    { email: 'manager@collegea.edu', password: 'password123', role: 'manager', full_name: 'Manager One', tenant_id: collegeAId },
  ];

  for (const u of users) {
    // Create in auth.users
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    });
    
    if (authErr) {
      if (authErr.message.includes('already exists')) {
         logger.info({ email: u.email }, 'User already exists in auth');
         // Need to fetch their auth ID to ensure public.users is synced
         continue; // For simplicity, assume if they exist, public.users does too for this test.
      } else {
        logger.error({ err: authErr }, 'Auth error');
        continue;
      }
    }
    
    // Create in public.users
    const { error: pErr } = await supabase.from('users').insert({
      id: authUser.user.id,
      tenant_id: u.tenant_id,
      role: u.role,
      full_name: u.full_name,
      is_active: true
    });
    
    if (pErr) logger.error({ err: pErr }, 'Public user error');
  }
  
  logger.info('Seed complete');
}

seed();
