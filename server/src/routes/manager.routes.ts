// SECURITY: using Supabase client — parameterized queries, no raw SQL concatenation
import { Router, Request, Response } from 'express';
import multer from 'multer';
import Papa from 'papaparse';
import { supabase } from '../lib/supabase';
import { getTenantId } from '../utils/tenant';
import { sendRecoveryMessage } from '../services/messaging.service';
import crypto from 'crypto';
import { validateBody } from '../middleware/validateBody';
import { studentImportLimiter } from '../middleware/rateLimiters';
import {
  createAssignmentSchema,
  createCounsellorSchema,
  emptyManagerBodySchema,
  emptyImportBodySchema,
  reassignAssignmentSchema,
  updateCounsellorSchema,
  inviteSingleSchema,
  institutionSettingsSchema,
} from '../validators/manager.validators';
import { inviteBulkLimiter } from '../middleware/rateLimiters';
import { logger } from '../lib/logger';
import { notify } from '../services/notificationService';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

// --- STUDENT ENDPOINTS ---

router.post('/students/import', studentImportLimiter, upload.single('file'), validateBody(emptyImportBodySchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    if (!req.file) {
      res.status(400).json({ error: 'No CSV file provided' });
      return;
    }

    const csvData = req.file.buffer.toString('utf-8');
    const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });
    
    if (parsed.errors.length > 0) {
      res.status(400).json({ error: 'Failed to parse CSV', details: parsed.errors });
      return;
    }

    const rows = parsed.data as any[];
    if (rows.length > 500) {
      res.status(400).json({ error: 'CSV exceeds 500 row limit' });
      return;
    }

    const errors: { row: number; reason: string }[] = [];
    const validRows: any[] = [];

    // Pre-fetch all roll numbers for this tenant to check duplicates
    const { data: existingUsers } = await supabase
      .from('users')
      .select('roll_number')
      .eq('tenant_id', tenantId)
      .not('roll_number', 'is', null);

    const existingRollNumbers = new Set(existingUsers?.map(u => u.roll_number) || []);

    rows.forEach((row, index) => {
      const rowNum = index + 1;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRegex = /^\+?[0-9\s\-\(\)]{7,15}$/;
      const alphanumericRegex = /^[a-zA-Z0-9]+$/;

      if (!row.email || !emailRegex.test(row.email)) {
        errors.push({ row: rowNum, reason: 'Invalid or missing email' });
      } else if (!row.full_name || row.full_name.trim().length === 0) {
        errors.push({ row: rowNum, reason: 'Missing full_name' });
      } else if (!row.roll_number || !alphanumericRegex.test(row.roll_number)) {
        errors.push({ row: rowNum, reason: 'Missing or invalid roll_number (alphanumeric only)' });
      } else if (row.phone && !phoneRegex.test(row.phone)) {
        errors.push({ row: rowNum, reason: 'Invalid phone format' });
      } else if (existingRollNumbers.has(row.roll_number)) {
        errors.push({ row: rowNum, reason: 'Roll number already exists' });
      } else {
        validRows.push({ ...row, rowNum });
      }
    });

    let created = 0;
    let failed = 0;

    for (const row of validRows) {
      const tempPassword = crypto.randomUUID();
      
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email: row.email,
        password: tempPassword,
        email_confirm: true,
      });

      if (authErr) {
        failed++;
        errors.push({ row: row.rowNum, reason: `Auth creation failed: ${authErr.message}` });
        continue;
      }

      const userId = authData.user.id;

      const { error: dbErr } = await supabase.from('users').insert({
        id: userId,
        tenant_id: tenantId,
        role: 'student',
        full_name: row.full_name,
        roll_number: row.roll_number,
        phone: row.phone || null,
        branch: row.branch || null,
        batch: row.batch || null,
        semester: row.semester ? parseInt(row.semester) : null,
        is_active: true
      });

      if (dbErr) {
        await supabase.auth.admin.deleteUser(userId);
        failed++;
        errors.push({ row: row.rowNum, reason: `DB insertion failed: ${dbErr.message}` });
        continue;
      }

      // Generate recovery link
      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: row.email
      });

      if (!linkErr && linkData.properties?.action_link) {
        await sendRecoveryMessage('whatsapp', row.phone || row.email, linkData.properties.action_link, row.full_name);
      } else if (linkErr) {
        logger.error({ err: linkErr, email: row.email }, 'Failed to generate recovery link');
      }

      created++;
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      actor_id: req.user!.id,
      action: 'bulk_import_students',
      metadata: { rows_attempted: rows.length, rows_created: created, rows_failed: failed }
    });

    res.json({ created, failed, errors });
  } catch (err: any) {
    logger.error({ err }, 'Student import error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/students', async (req: Request, res: Response): Promise<void> => {
  const tenantId = getTenantId(req);
  const { branch, batch, is_active } = req.query;

  let query = supabase
    .from('users')
    .select('id, full_name, roll_number, branch, batch, semester, is_active, user_preferences ( onboarding_complete )')
    .eq('tenant_id', tenantId)
    .eq('role', 'student');

  if (branch) query = query.eq('branch', branch);
  if (batch) query = query.eq('batch', batch);
  if (is_active !== undefined) query = query.eq('is_active', is_active === 'true');

  const { data, error } = await query;
  if (error) {
    logger.error({ err: error }, 'Failed to fetch students');
    res.status(500).json({ error: 'Failed to fetch students' });
    return;
  }

  const mappedData = data.map((d: any) => ({
    ...d,
    onboarding_complete: d.user_preferences?.[0]?.onboarding_complete || false,
    user_preferences: undefined
  }));

  res.json(mappedData);
});

router.patch('/students/:id/deactivate', validateBody(emptyManagerBodySchema), async (req: Request, res: Response): Promise<void> => {
  const tenantId = getTenantId(req);
  const studentId = req.params.id;

  const { error } = await supabase
    .from('users')
    .update({ is_active: false })
    .eq('id', studentId)
    .eq('tenant_id', tenantId)
    .eq('role', 'student');

  if (error) {
    logger.error({ err: error, studentId }, 'Failed to deactivate student');
    res.status(500).json({ error: 'Failed to deactivate student' });
    return;
  }

  await supabase.from('audit_logs').insert({
    tenant_id: tenantId,
    actor_id: req.user!.id,
    action: 'deactivate_student',
    target_id: studentId,
  });

  res.json({ success: true });
});

// ─── INSTITUTION SETTINGS ────────────────────────────────────────────────────

router.patch('/institution/settings', validateBody(institutionSettingsSchema), async (req: Request, res: Response): Promise<void> => {
  const tenantId = getTenantId(req);
  const { allowed_email_domains } = req.body;

  const { error } = await supabase
    .from('colleges')
    .update({ allowed_email_domains })
    .eq('id', tenantId);

  if (error) {
    logger.error({ err: error, tenantId }, 'Failed to update institution settings');
    res.status(500).json({ error: 'Failed to update institution settings' });
    return;
  }

  await supabase.from('audit_logs').insert({
    tenant_id: tenantId,
    actor_id: req.user!.id,
    action: 'update_institution_settings',
    metadata: { allowed_email_domains },
  });

  res.json({ success: true });
});

router.get('/institution/settings', async (req: Request, res: Response): Promise<void> => {
  const tenantId = getTenantId(req);

  const { data, error } = await supabase
    .from('colleges')
    .select('name, allowed_email_domains')
    .eq('id', tenantId)
    .single();

  if (error || !data) {
    res.status(500).json({ error: 'Failed to fetch institution settings' });
    return;
  }

  res.json({ name: data.name, allowed_email_domains: data.allowed_email_domains || [] });
});

// ─── STUDENT INVITE ENDPOINTS ─────────────────────────────────────────────────

router.post('/students/invite-single', validateBody(inviteSingleSchema), async (req: Request, res: Response): Promise<void> => {
  const tenantId = getTenantId(req);
  const { email, full_name, roll_number, batch, semester } = req.body;

  try {
    // Check for duplicate email in this tenant
    const { data: existingEmail } = await supabase
      .from('student_invites')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('email', email)
      .not('status', 'eq', 'expired')
      .maybeSingle();

    if (existingEmail) {
      res.status(409).json({ error: 'An invite already exists for this email address' });
      return;
    }

    // Check for duplicate roll number in this tenant
    const { data: existingRoll } = await supabase
      .from('student_invites')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('roll_number', roll_number)
      .not('status', 'eq', 'expired')
      .maybeSingle();

    if (existingRoll) {
      res.status(409).json({ error: 'An invite already exists for this roll number' });
      return;
    }

    const invite_token = crypto.randomUUID();
    const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const tempPassword = crypto.randomUUID();

    // Create Supabase Auth user (inactive until activated)
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });

    if (authErr) {
      res.status(400).json({ error: `Failed to create user account: ${authErr.message}` });
      return;
    }

    const authUserId = authData.user.id;

    // Insert into users table with is_active = false
    const { error: userErr } = await supabase.from('users').insert({
      id: authUserId,
      tenant_id: tenantId,
      role: 'student',
      full_name,
      roll_number,
      batch,
      semester,
      is_active: false,
    });

    if (userErr) {
      await supabase.auth.admin.deleteUser(authUserId);
      res.status(500).json({ error: `Failed to create user record: ${userErr.message}` });
      return;
    }

    // Insert invite record
    const { error: inviteErr } = await supabase.from('student_invites').insert({
      tenant_id: tenantId,
      email,
      full_name,
      roll_number,
      batch,
      semester,
      invited_by: req.user!.id,
      invite_token,
      expires_at,
      auth_user_id: authUserId,
    });

    if (inviteErr) {
      await supabase.auth.admin.deleteUser(authUserId);
      res.status(500).json({ error: `Failed to create invite record: ${inviteErr.message}` });
      return;
    }

    // Send activation email via Supabase recovery link
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const { error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${clientUrl}/activate?token=${invite_token}` },
    });

    if (linkErr) {
      logger.error({ err: linkErr, email }, 'Failed to generate activation link');
    }

    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      actor_id: req.user!.id,
      action: 'student_invited',
      target_id: authUserId,
      metadata: { roll_number, batch },
    });

    res.json({ invited: true, email, expires_at });
  } catch (err: any) {
    logger.error({ err }, 'Student invite-single error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/students/invite-bulk', inviteBulkLimiter, upload.single('file'), validateBody(emptyImportBodySchema), async (req: Request, res: Response): Promise<void> => {
  const tenantId = getTenantId(req);

  if (!req.file) {
    res.status(400).json({ error: 'No CSV file provided' });
    return;
  }

  const csvData = req.file.buffer.toString('utf-8');
  const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });

  if (parsed.errors.length > 0) {
    res.status(400).json({ error: 'Failed to parse CSV', details: parsed.errors });
    return;
  }

  const rows = parsed.data as any[];
  if (rows.length > 200) {
    res.status(400).json({ error: 'CSV exceeds 200 row limit per upload' });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const alphanumericRegex = /^[a-zA-Z0-9]+$/;

  // Pre-fetch existing invites to check duplicates
  const { data: existingInvites } = await supabase
    .from('student_invites')
    .select('email, roll_number')
    .eq('tenant_id', tenantId)
    .not('status', 'eq', 'expired');

  const existingEmails = new Set(existingInvites?.map(i => i.email) || []);
  const existingRolls = new Set(existingInvites?.map(i => i.roll_number) || []);

  const errors: { row: number; email: string; reason: string }[] = [];
  const validRows: any[] = [];

  rows.forEach((row, index) => {
    const rowNum = index + 1;
    const email = (row.email || '').trim();
    const roll = (row.roll_number || '').trim();
    if (!email || !emailRegex.test(email)) {
      errors.push({ row: rowNum, email, reason: 'Invalid or missing email' });
    } else if (!row.full_name || !row.full_name.trim()) {
      errors.push({ row: rowNum, email, reason: 'Missing full_name' });
    } else if (!roll || !alphanumericRegex.test(roll)) {
      errors.push({ row: rowNum, email, reason: 'Missing or invalid roll_number (alphanumeric only)' });
    } else if (!row.batch || !row.batch.trim()) {
      errors.push({ row: rowNum, email, reason: 'Missing batch' });
    } else if (!row.semester || isNaN(parseInt(row.semester)) || parseInt(row.semester) < 1 || parseInt(row.semester) > 8) {
      errors.push({ row: rowNum, email, reason: 'Missing or invalid semester (must be 1–8)' });
    } else if (existingEmails.has(email)) {
      errors.push({ row: rowNum, email, reason: 'Email already invited' });
    } else if (existingRolls.has(roll)) {
      errors.push({ row: rowNum, email, reason: 'Roll number already invited' });
    } else {
      validRows.push({ ...row, rowNum, email, roll_number: roll });
    }
  });

  let invited = 0;
  let failed = errors.length;
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  for (const row of validRows) {
    try {
      const invite_token = crypto.randomUUID();
      const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const tempPassword = crypto.randomUUID();
      const { email, roll_number } = row;
      const full_name = row.full_name.trim();
      const batch = row.batch.trim();
      const semester = parseInt(row.semester);

      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
      });

      if (authErr) {
        failed++;
        errors.push({ row: row.rowNum, email, reason: `Auth creation failed: ${authErr.message}` });
        continue;
      }

      const authUserId = authData.user.id;

      const { error: userErr } = await supabase.from('users').insert({
        id: authUserId,
        tenant_id: tenantId,
        role: 'student',
        full_name,
        roll_number,
        batch,
        semester,
        is_active: false,
      });

      if (userErr) {
        await supabase.auth.admin.deleteUser(authUserId);
        failed++;
        errors.push({ row: row.rowNum, email, reason: `DB insertion failed: ${userErr.message}` });
        continue;
      }

      const { error: inviteErr } = await supabase.from('student_invites').insert({
        tenant_id: tenantId,
        email,
        full_name,
        roll_number,
        batch,
        semester,
        invited_by: req.user!.id,
        invite_token,
        expires_at,
        auth_user_id: authUserId,
      });

      if (inviteErr) {
        await supabase.auth.admin.deleteUser(authUserId);
        failed++;
        errors.push({ row: row.rowNum, email, reason: `Invite record failed: ${inviteErr.message}` });
        continue;
      }

      await supabase.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: `${clientUrl}/activate?token=${invite_token}` },
      });

      invited++;
    } catch (rowErr: any) {
      failed++;
      errors.push({ row: row.rowNum, email: row.email, reason: rowErr.message || 'Unknown error' });
    }
  }

  await supabase.from('audit_logs').insert({
    tenant_id: tenantId,
    actor_id: req.user!.id,
    action: 'student_invited',
    metadata: { total: rows.length, invited, failed },
  });

  res.json({ total: rows.length, invited, failed, errors });
});

router.get('/students/invite-status', async (req: Request, res: Response): Promise<void> => {
  const tenantId = getTenantId(req);

  const { data, error } = await supabase
    .from('student_invites')
    .select('id, email, full_name, roll_number, batch, semester, status, created_at, expires_at, activated_at, resend_count')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error({ err: error }, 'Failed to fetch invite status');
    res.status(500).json({ error: 'Failed to fetch invite status' });
    return;
  }

  const invites = (data || []).map(i => ({
    id: i.id,
    email: i.email,
    full_name: i.full_name,
    roll_number: i.roll_number,
    batch: i.batch,
    semester: i.semester,
    status: i.status,
    invited_at: i.created_at,
    expires_at: i.expires_at,
    activated_at: i.activated_at,
    resend_count: i.resend_count || 0,
  }));

  res.json({ invites });
});

router.post('/students/resend-invite/:inviteId', validateBody(emptyManagerBodySchema), async (req: Request, res: Response): Promise<void> => {
  const tenantId = getTenantId(req);
  const inviteId = req.params.inviteId;

  const { data: invite, error: fetchErr } = await supabase
    .from('student_invites')
    .select('id, email, full_name, status, resend_count')
    .eq('id', inviteId)
    .eq('tenant_id', tenantId)
    .single();

  if (fetchErr || !invite) {
    res.status(404).json({ error: 'Invite not found' });
    return;
  }

  if (invite.status === 'activated') {
    res.status(400).json({ error: 'This student has already activated their account' });
    return;
  }

  if ((invite.resend_count || 0) >= 3) {
    res.status(429).json({ error: 'Maximum resend limit (3) reached for this invite' });
    return;
  }

  const new_token = crypto.randomUUID();
  const new_expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: updateErr } = await supabase
    .from('student_invites')
    .update({
      invite_token: new_token,
      expires_at: new_expires_at,
      status: 'resent',
      resend_count: (invite.resend_count || 0) + 1,
    })
    .eq('id', inviteId)
    .eq('tenant_id', tenantId);

  if (updateErr) {
    res.status(500).json({ error: 'Failed to update invite' });
    return;
  }

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const { error: linkErr } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email: invite.email,
    options: { redirectTo: `${clientUrl}/activate?token=${new_token}` },
  });

  if (linkErr) {
    logger.error({ err: linkErr, email: invite.email }, 'Failed to resend activation email');
  }

  await supabase.from('audit_logs').insert({
    tenant_id: tenantId,
    actor_id: req.user!.id,
    action: 'invite_resent',
    metadata: { invite_id: inviteId },
  });

  res.json({ resent: true, expires_at: new_expires_at });
});

router.delete('/students/revoke-invite/:inviteId', async (req: Request, res: Response): Promise<void> => {
  const tenantId = getTenantId(req);
  const inviteId = req.params.inviteId;

  const { data: invite, error: fetchErr } = await supabase
    .from('student_invites')
    .select('id, email, auth_user_id, status')
    .eq('id', inviteId)
    .eq('tenant_id', tenantId)
    .single();

  if (fetchErr || !invite) {
    res.status(404).json({ error: 'Invite not found' });
    return;
  }

  const { error: updateErr } = await supabase
    .from('student_invites')
    .update({ status: 'expired' })
    .eq('id', inviteId)
    .eq('tenant_id', tenantId);

  if (updateErr) {
    res.status(500).json({ error: 'Failed to revoke invite' });
    return;
  }

  if (invite.auth_user_id) {
    await supabase
      .from('users')
      .update({ is_active: false })
      .eq('id', invite.auth_user_id)
      .eq('tenant_id', tenantId);
  }

  await supabase.from('audit_logs').insert({
    tenant_id: tenantId,
    actor_id: req.user!.id,
    action: 'invite_revoked',
    metadata: { invite_id: inviteId },
  });

  res.json({ revoked: true });
});

// --- COUNSELLOR ENDPOINTS ---

router.post('/counsellors', validateBody(createCounsellorSchema), async (req: Request, res: Response): Promise<void> => {
  const tenantId = getTenantId(req);
  const { full_name, email, phone, specialisation_tags, personality_description, capacity_limit } = req.body;

  try {
    const tempPassword = crypto.randomUUID();
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });

    if (authErr) {
      res.status(400).json({ error: `Auth creation failed: ${authErr.message}` });
      return;
    }

    const userId = authData.user.id;

    const { error: dbErr } = await supabase.from('users').insert({
      id: userId,
      tenant_id: tenantId,
      role: 'counsellor',
      full_name,
      phone: phone || null,
      is_active: true
    });

    if (dbErr) {
      await supabase.auth.admin.deleteUser(userId);
      res.status(500).json({ error: `DB insertion failed: ${dbErr.message}` });
      return;
    }

    const { error: profileErr } = await supabase.from('counsellor_profiles').insert({
      counsellor_id: userId,
      tenant_id: tenantId,
      specialisation_tags: specialisation_tags || [],
      personality_description: personality_description || null,
      capacity_limit: capacity_limit || 20,
      is_on_leave: false
    });

    if (profileErr) {
      logger.error({ err: profileErr, counsellorId: userId }, 'Profile creation error');
    }

    // Send reset link
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email
    });

    if (!linkErr && linkData.properties?.action_link) {
       await sendRecoveryMessage('whatsapp', phone || email, linkData.properties.action_link, full_name);
    }

    await supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      actor_id: req.user!.id,
      action: 'create_counsellor',
      target_id: userId,
    });

    res.json({ success: true, id: userId });
  } catch (err: any) {
    logger.error({ err }, 'Create counsellor error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/counsellors', async (req: Request, res: Response): Promise<void> => {
  const tenantId = getTenantId(req);

  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, phone, is_active, counsellor_profiles ( specialisation_tags, personality_description, capacity_limit, is_on_leave )')
    .eq('tenant_id', tenantId)
    .eq('role', 'counsellor');

  if (error) {
    logger.error({ err: error }, 'Failed to fetch counsellors');
    res.status(500).json({ error: 'Failed to fetch counsellors' });
    return;
  }

  const mappedData = data.map((d: any) => ({
    id: d.id,
    full_name: d.full_name,
    phone: d.phone,
    is_active: d.is_active,
    ...d.counsellor_profiles?.[0],
    current_caseload_count: 0 // Mocked for now, needs DB join or view
  }));

  res.json(mappedData);
});

router.patch('/counsellors/:id', validateBody(updateCounsellorSchema), async (req: Request, res: Response): Promise<void> => {
  const tenantId = getTenantId(req);
  const counsellorId = req.params.id;
  const { specialisation_tags, personality_description, capacity_limit, is_on_leave } = req.body;

  const updates: any = {};
  if (specialisation_tags !== undefined) updates.specialisation_tags = specialisation_tags;
  if (personality_description !== undefined) updates.personality_description = personality_description;
  if (capacity_limit !== undefined) updates.capacity_limit = capacity_limit;
  if (is_on_leave !== undefined) updates.is_on_leave = is_on_leave;

  const { error } = await supabase
    .from('counsellor_profiles')
    .update(updates)
    .eq('counsellor_id', counsellorId)
    .eq('tenant_id', tenantId);

  if (error) {
    logger.error({ err: error, counsellorId }, 'Failed to update counsellor profile');
    res.status(500).json({ error: 'Failed to update counsellor profile' });
    return;
  }

  await supabase.from('audit_logs').insert({
    tenant_id: tenantId,
    actor_id: req.user!.id,
    action: 'update_counsellor_profile',
    target_id: counsellorId,
    metadata: updates
  });

  res.json({ success: true });
});


// ─── DASHBOARD ───────────────────────────────────────────────────────────────

const getWeekStart = (): string => {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
};

router.get('/dashboard', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const weekStart = getWeekStart();

    const [studentsRes, newFlagsRes, pendingRes, openIntRes, checkinStudentsRes, totalStudentsRes] =
      await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId).eq('role', 'student').eq('is_active', true),
        supabase.from('flags').select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId).gte('created_at', weekStart),
        supabase.from('flags').select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId).eq('status', 'unassigned'),
        supabase.from('counsellor_assignments').select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId).in('status', ['pending_contact', 'contacted', 'ongoing']),
        supabase.from('checkins').select('student_id')
          .eq('tenant_id', tenantId).gte('week_start', weekStart),
        supabase.from('users').select('id').eq('tenant_id', tenantId).eq('role', 'student').eq('is_active', true),
      ]);

    const totalStudents = studentsRes.count || 0;
    const checkinStudents = new Set(checkinStudentsRes.data?.map(c => c.student_id) || []).size;
    const completionRate = totalStudents > 0 ? Math.round((checkinStudents / totalStudents) * 100) : 0;

    res.json({
      total_active_students: totalStudents,
      new_flags_this_week: newFlagsRes.count || 0,
      pending_assignments: pendingRes.count || 0,
      open_interventions: openIntRes.count || 0,
      checkin_completion_rate: completionRate,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─── HEATMAP ─────────────────────────────────────────────────────────────────

router.get('/heatmap', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);

    const { data: students } = await supabase
      .from('users')
      .select('id, branch, batch')
      .eq('tenant_id', tenantId).eq('role', 'student').eq('is_active', true);

    const { data: signals } = await supabase
      .from('wellness_signals')
      .select('student_id, academic_status, emotional_status, social_status')
      .eq('tenant_id', tenantId);

    const signalMap: Record<string, any> = {};
    signals?.forEach(s => { signalMap[s.student_id] = s; });

    const groups: Record<string, any> = {};
    students?.forEach(s => {
      const key = `${s.branch || 'Unknown'}||${s.batch || 'Unknown'}`;
      if (!groups[key]) {
        groups[key] = { branch: s.branch || 'Unknown', batch: s.batch || 'Unknown', total_students: 0, academic_risk_count: 0, emotional_risk_count: 0, social_risk_count: 0 };
      }
      groups[key].total_students++;
      const sig = signalMap[s.id];
      if (sig?.academic_status === 'risk') groups[key].academic_risk_count++;
      if (sig?.emotional_status === 'risk') groups[key].emotional_risk_count++;
      if (sig?.social_status === 'risk') groups[key].social_risk_count++;
    });

    res.json({ heatmap: Object.values(groups) });
  } catch (err: any) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─── FLAGS LIST ───────────────────────────────────────────────────────────────

router.get('/flags', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const { branch, batch, risk_level, status } = req.query;

    const { data: flags, error } = await supabase
      .from('flags')
      .select('id, student_id, risk_level, triggered_dimensions, weeks_flagged, status, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .not('status', 'in', '("resolved","escalated")')
      .order('created_at', { ascending: false });

    if (error) { res.status(500).json({ error: 'Failed to fetch flags' }); return; }

    const studentIds = [...new Set(flags?.map(f => f.student_id) || [])];
    const { data: students } = await supabase
      .from('users')
      .select('id, full_name, branch, batch, semester')
      .in('id', studentIds.length ? studentIds : ['00000000-0000-0000-0000-000000000000']);

    const { data: assignments } = await supabase
      .from('counsellor_assignments')
      .select('flag_id, status, counsellor_id')
      .eq('tenant_id', tenantId)
      .in('flag_id', flags?.map(f => f.id) || []);

    const { data: lastCheckins } = await supabase
      .from('checkins')
      .select('student_id, submitted_at')
      .in('student_id', studentIds.length ? studentIds : ['00000000-0000-0000-0000-000000000000'])
      .order('submitted_at', { ascending: false });

    const studentMap: Record<string, any> = {};
    students?.forEach(s => { studentMap[s.id] = s; });
    const assignMap: Record<string, any> = {};
    assignments?.forEach(a => { assignMap[a.flag_id] = a; });
    const lastCheckinMap: Record<string, string> = {};
    lastCheckins?.forEach(c => { if (!lastCheckinMap[c.student_id]) lastCheckinMap[c.student_id] = c.submitted_at; });

    let result = (flags || []).map(f => {
      const student = studentMap[f.student_id] || {};
      const assignment = assignMap[f.id];
      return {
        flag_id: f.id,
        student_name: student.full_name || 'Unknown',
        branch: student.branch,
        batch: student.batch,
        semester: student.semester,
        risk_level: f.risk_level,
        triggered_dimensions: f.triggered_dimensions,
        weeks_flagged: f.weeks_flagged,
        flag_status: f.status,
        assignment_status: assignment?.status || null,
        last_checkin_date: lastCheckinMap[f.student_id] || null,
        student_id: f.student_id,
      };
    });

    if (branch) result = result.filter(r => r.branch === branch);
    if (batch) result = result.filter(r => r.batch === batch);
    if (risk_level) result = result.filter(r => r.risk_level === risk_level);
    if (status) result = result.filter(r => r.flag_status === status || r.assignment_status === status);

    const riskOrder: Record<string, number> = { high: 0, medium: 1, watch: 2 };
    result.sort((a, b) => {
      if (a.flag_status === 'unassigned' && b.flag_status !== 'unassigned') return -1;
      if (b.flag_status === 'unassigned' && a.flag_status !== 'unassigned') return 1;
      return (riskOrder[a.risk_level] ?? 3) - (riskOrder[b.risk_level] ?? 3);
    });

    res.json({ flags: result });
  } catch (err: any) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─── STUDENT REPORT ───────────────────────────────────────────────────────────

router.get('/students/:id/report', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const studentId = req.params.id;
    const managerId = req.user!.id;

    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const fourWeeksAgoStr = fourWeeksAgo.toISOString().split('T')[0];

    const [studentRes, signalsRes, checkinsRes, flagsRes] = await Promise.all([
      supabase.from('users').select('id, full_name, branch, batch, semester, roll_number, created_at')
        .eq('id', studentId).eq('tenant_id', tenantId).single(),
      supabase.from('wellness_signals')
        .select('academic_status, emotional_status, social_status, academic_score, emotional_score, social_score, calculated_at')
        .eq('student_id', studentId).eq('tenant_id', tenantId)
        .order('calculated_at', { ascending: false }).limit(1).single(),
      supabase.from('checkins')
        .select('week_start, dimension, response_score')
        .eq('student_id', studentId).eq('tenant_id', tenantId)
        .gte('week_start', fourWeeksAgoStr)
        .order('week_start', { ascending: true }),
      supabase.from('flags')
        .select('risk_level, triggered_dimensions, weeks_flagged, status, created_at')
        .eq('student_id', studentId).eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }),
    ]);

    if (!studentRes.data) { res.status(404).json({ error: 'Student not found' }); return; }

    // Group checkins by week
    const checkinByWeek: Record<string, any> = {};
    checkinsRes.data?.forEach(c => {
      if (!checkinByWeek[c.week_start]) checkinByWeek[c.week_start] = { week_start: c.week_start };
      checkinByWeek[c.week_start][`${c.dimension}_score`] = c.response_score;
    });

    // Audit log (non-blocking)
    void supabase.from('audit_logs').insert({
      tenant_id: tenantId,
      actor_id: managerId,
      action: 'viewed_student_report',
      target_id: studentId,
    });

    res.json({
      student: studentRes.data,
      wellness_snapshot: signalsRes.data || null,
      checkin_trend: Object.values(checkinByWeek),
      flag_history: flagsRes.data || [],
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─── CREATE ASSIGNMENT ────────────────────────────────────────────────────────

router.post('/assignments', validateBody(createAssignmentSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const managerId = req.user!.id;
    const { student_id, counsellor_id, flag_id, manager_note } = req.body;

    const { data: assignment, error: assignErr } = await supabase
      .from('counsellor_assignments')
      .insert({ tenant_id: tenantId, student_id, counsellor_id, flag_id, manager_note: manager_note || null, status: 'pending_contact' })
      .select('id').single();

    if (assignErr) { res.status(500).json({ error: 'Failed to create assignment' }); return; }

    await supabase.from('flags').update({ status: 'assigned' }).eq('id', flag_id).eq('tenant_id', tenantId);

    void supabase.from('audit_logs').insert({
      tenant_id: tenantId, actor_id: managerId, action: 'create_assignment',
      target_id: student_id, metadata: { counsellor_id, flag_id, assignment_id: assignment?.id },
    });

    // Notify Counsellor (Immediate In-App + WhatsApp)
    void notify(
      counsellor_id,
      tenantId,
      'A new student has been assigned to you. Please review the flag and initiate contact.',
      'assignment',
      'both'
    );

    // Notify Student (In-App fallback, WhatsApp primary)
    void notify(
      student_id,
      tenantId,
      'Someone from the student support team will be in touch with you soon.',
      'assignment'
    );

    res.json({ success: true, assignment_id: assignment?.id });
  } catch (err: any) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─── REASSIGN ─────────────────────────────────────────────────────────────────

router.patch('/assignments/:id/reassign', validateBody(reassignAssignmentSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const managerId = req.user!.id;
    const assignmentId = req.params.id;
    const { new_counsellor_id, reason } = req.body;

    const { error } = await supabase
      .from('counsellor_assignments')
      .update({ counsellor_id: new_counsellor_id, status: 'pending_contact', first_contact_at: null })
      .eq('id', assignmentId).eq('tenant_id', tenantId);

    if (error) { res.status(500).json({ error: 'Failed to reassign' }); return; }

    void supabase.from('audit_logs').insert({
      tenant_id: tenantId, actor_id: managerId, action: 'reassign_counsellor',
      target_id: assignmentId, metadata: { new_counsellor_id, reason },
    });

    // Notify New Counsellor (Immediate In-App + WhatsApp)
    void notify(
      new_counsellor_id,
      tenantId,
      `A student has been reassigned to you. Reason: ${reason || 'Not specified'}.`,
      'assignment',
      'both'
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─── INTERVENTIONS ────────────────────────────────────────────────────────────

router.get('/interventions', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);

    const { data: assignments, error } = await supabase
      .from('counsellor_assignments')
      .select('id, student_id, counsellor_id, status, assigned_at, first_contact_at, resolved_at, manager_note')
      .eq('tenant_id', tenantId)
      .in('status', ['pending_contact', 'contacted', 'ongoing'])
      .order('assigned_at', { ascending: false });

    if (error) { res.status(500).json({ error: 'Failed to fetch interventions' }); return; }

    const studentIds = [...new Set(assignments?.map(a => a.student_id) || [])];
    const counsellorIds = [...new Set(assignments?.map(a => a.counsellor_id) || [])];
    const allIds = [...new Set([...studentIds, ...counsellorIds])];

    const { data: users } = await supabase
      .from('users').select('id, full_name, branch, batch')
      .in('id', allIds.length ? allIds : ['00000000-0000-0000-0000-000000000000']);

    const userMap: Record<string, any> = {};
    users?.forEach(u => { userMap[u.id] = u; });

    const now = Date.now();
    const OVERDUE_DAYS = 5;

    const result = (assignments || []).map(a => {
      const daysSince = Math.floor((now - new Date(a.assigned_at).getTime()) / 86400000);
      const isOverdue = !a.first_contact_at && daysSince > OVERDUE_DAYS;
      return {
        assignment_id: a.id,
        student_name: userMap[a.student_id]?.full_name || 'Unknown',
        student_branch: userMap[a.student_id]?.branch || null,
        counsellor_name: userMap[a.counsellor_id]?.full_name || 'Unknown',
        status: a.status,
        assigned_at: a.assigned_at,
        first_contact_at: a.first_contact_at,
        days_since_assignment: daysSince,
        is_overdue: isOverdue,
        manager_note: a.manager_note,
      };
    });

    res.json({ interventions: result });
  } catch (err: any) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─── SEMESTER REPORT ─────────────────────────────────────────────────────────

router.get('/reports/semester', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);
    const twelveWeeksAgoStr = twelveWeeksAgo.toISOString().split('T')[0];

    const [flagsRes, assignmentsRes, checkinsRes, studentsRes] = await Promise.all([
      supabase.from('flags').select('risk_level, triggered_dimensions, status, created_at')
        .eq('tenant_id', tenantId).gte('created_at', twelveWeeksAgoStr),
      supabase.from('counsellor_assignments')
        .select('status, assigned_at, first_contact_at, resolved_at')
        .eq('tenant_id', tenantId).gte('assigned_at', twelveWeeksAgoStr),
      supabase.from('checkins').select('week_start, student_id')
        .eq('tenant_id', tenantId).gte('week_start', twelveWeeksAgoStr),
      supabase.from('users').select('id').eq('tenant_id', tenantId).eq('role', 'student').eq('is_active', true),
    ]);

    const flags = flagsRes.data || [];
    const assignments = assignmentsRes.data || [];
    const totalStudents = studentsRes.data?.length || 1;

    // Flags by dimension
    const byDimension: Record<string, number> = {};
    flags.forEach(f => {
      (f.triggered_dimensions || []).forEach((d: string) => {
        byDimension[d] = (byDimension[d] || 0) + 1;
      });
    });

    // Avg time to first contact (in hours)
    const contactTimes = assignments
      .filter(a => a.first_contact_at)
      .map(a => (new Date(a.first_contact_at!).getTime() - new Date(a.assigned_at).getTime()) / 3600000);
    const avgContactHours = contactTimes.length
      ? Math.round(contactTimes.reduce((s, v) => s + v, 0) / contactTimes.length)
      : null;

    // Resolution rate
    const resolved = assignments.filter(a => a.status === 'resolved').length;
    const resolutionRate = assignments.length > 0 ? Math.round((resolved / assignments.length) * 100) : 0;

    // Weekly checkin engagement (last 8 weeks)
    const weekMap: Record<string, Set<string>> = {};
    (checkinsRes.data || []).forEach(c => {
      if (!weekMap[c.week_start]) weekMap[c.week_start] = new Set();
      weekMap[c.week_start].add(c.student_id);
    });
    const weeklyEngagement = Object.entries(weekMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([week, students]) => ({
        week,
        students_checked_in: students.size,
        rate: Math.round((students.size / totalStudents) * 100),
      }));

    // Flags by week
    const flagsByWeek: Record<string, number> = {};
    flags.forEach(f => {
      const w = f.created_at.split('T')[0].substring(0, 8) + '01'; // month bucket simplified
      const week = f.created_at.substring(0, 10);
      flagsByWeek[week] = (flagsByWeek[week] || 0) + 1;
    });
    const flagTrend = Object.entries(flagsByWeek)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([week, count]) => ({ week, count }));

    res.json({
      total_flagged: flags.length,
      flags_by_dimension: byDimension,
      avg_time_to_first_contact_hours: avgContactHours,
      resolution_rate: resolutionRate,
      weekly_engagement: weeklyEngagement,
      flag_trend: flagTrend,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─── WELLNESS ANALYTICS (reflection-based aggregates) ────────────────────────
// Population-level view derived from weekly_reflections + recommendations.
// Complements /heatmap (structural by branch/batch) with sentiment data.
router.get('/wellness-analytics', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [reflectionsRes, recommendationsRes] = await Promise.all([
      supabase
        .from('weekly_reflections')
        .select('student_id, emotional_score, severity, indicators, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', thirtyDaysAgo),
      supabase
        .from('recommendations')
        .select('type, priority, status')
        .eq('tenant_id', tenantId)
        .eq('status', 'active'),
    ]);

    const reflections = reflectionsRes.data ?? [];
    const recommendations = recommendationsRes.data ?? [];

    // Population sentiment averages
    const emotionalScores = reflections
      .map((r: any) => r.emotional_score)
      .filter((v: any): v is number => typeof v === 'number');
    const avgEmotional =
      emotionalScores.length > 0
        ? Math.round(emotionalScores.reduce((a: number, b: number) => a + b, 0) / emotionalScores.length)
        : null;

    // Per-indicator averages
    const indicatorKeys = ['stress', 'loneliness', 'exhaustion', 'motivationDecline', 'anxiety', 'sleepDecline'];
    const indicatorTotals: Record<string, { sum: number; count: number }> = {};
    for (const k of indicatorKeys) indicatorTotals[k] = { sum: 0, count: 0 };
    for (const r of reflections) {
      const ind = ((r as any).indicators ?? {}) as Record<string, number>;
      for (const k of indicatorKeys) {
        if (typeof ind[k] === 'number') {
          indicatorTotals[k].sum += ind[k];
          indicatorTotals[k].count += 1;
        }
      }
    }
    const indicatorAverages: Record<string, number | null> = {};
    for (const k of indicatorKeys) {
      const { sum, count } = indicatorTotals[k];
      indicatorAverages[k] = count > 0 ? Math.round(sum / count) : null;
    }

    // Severity distribution
    const severityDist: Record<string, number> = { Low: 0, Moderate: 0, High: 0, Critical: 0 };
    for (const r of reflections) {
      const sev = (r as any).severity ?? 'Low';
      if (sev in severityDist) severityDist[sev]++;
    }

    const reflectingStudents = new Set(reflections.map((r: any) => r.student_id)).size;

    // Daily emotional heatmap (last 30d)
    const dailyMap: Record<string, { sum: number; count: number }> = {};
    for (const r of reflections) {
      const r2 = r as any;
      if (typeof r2.emotional_score !== 'number' || !r2.created_at) continue;
      const day = String(r2.created_at).slice(0, 10);
      if (!dailyMap[day]) dailyMap[day] = { sum: 0, count: 0 };
      dailyMap[day].sum += r2.emotional_score;
      dailyMap[day].count += 1;
    }
    const emotionalHeatmap = Object.entries(dailyMap)
      .map(([day, { sum, count }]) => ({
        day,
        average_emotional_score: Math.round(sum / count),
        count,
      }))
      .sort((a, b) => a.day.localeCompare(b.day));

    // Active recommendation distribution
    const recsByType: Record<string, number> = {};
    const recsByPriority: Record<string, number> = { Low: 0, Moderate: 0, High: 0, Critical: 0 };
    for (const rec of recommendations as any[]) {
      recsByType[rec.type] = (recsByType[rec.type] ?? 0) + 1;
      if (rec.priority in recsByPriority) recsByPriority[rec.priority]++;
    }

    res.json({
      window_days: 30,
      reflecting_students: reflectingStudents,
      population: {
        average_emotional_score: avgEmotional,
        indicator_averages: indicatorAverages,
        severity_distribution: severityDist,
      },
      emotional_heatmap: emotionalHeatmap,
      active_recommendations: {
        total: recommendations.length,
        by_type: recsByType,
        by_priority: recsByPriority,
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'wellness-analytics failed');
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─── DROPOUT RISK — single student ──────────────────────────────────────────
// Returns the full risk profile with factor breakdown. Manager-only.
router.get('/risk/:studentId', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const { studentId } = req.params;

    const [userRes, lmsRes, snapsRes] = await Promise.all([
      supabase
        .from('users')
        .select('id, full_name, roll_number, branch, batch')
        .eq('id', studentId)
        .eq('tenant_id', tenantId)
        .single(),
      supabase
        .from('lms_data')
        .select(
          'attendance_pct, assignment_completion_pct, assessments_completed, assessments_total, lectures_attended, lectures_total, xp_total, batch_rank, batch_size, dropout_risk_score, dropout_risk_level, dropout_risk_factors, dropout_risk_computed_at, synced_at',
        )
        .eq('student_id', studentId)
        .eq('tenant_id', tenantId)
        .maybeSingle(),
      supabase
        .from('lms_snapshots')
        .select('attendance_pct, assignment_completion_pct, assessments_completed, assessments_total, captured_at')
        .eq('student_id', studentId)
        .eq('tenant_id', tenantId)
        .order('captured_at', { ascending: false })
        .limit(12),
    ]);

    if (userRes.error || !userRes.data) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    res.json({
      student: userRes.data,
      lms: lmsRes.data,
      snapshots: (snapsRes.data ?? []).slice().reverse(), // oldest-first for charts
    });
  } catch (err: any) {
    logger.error({ err }, 'GET /risk/:studentId failed');
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ─── DROPOUT RISK — cohort ranking ──────────────────────────────────────────
// Ranks all students in the tenant by current dropout_risk_score (desc).
// Supports optional ?branch=, ?batch=, ?min_level=high filters.
router.get('/cohort-risk', async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getTenantId(req);
    const { branch, batch, min_level } = req.query;

    // 1. Fetch lms_data rows with a non-null risk score in this tenant
    let lmsQuery = supabase
      .from('lms_data')
      .select(
        'student_id, attendance_pct, assignment_completion_pct, dropout_risk_score, dropout_risk_level, dropout_risk_computed_at',
      )
      .eq('tenant_id', tenantId)
      .not('dropout_risk_score', 'is', null);

    const levelRanking: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
    if (typeof min_level === 'string' && min_level in levelRanking) {
      const allowed = Object.entries(levelRanking)
        .filter(([, rank]) => rank >= levelRanking[min_level])
        .map(([lvl]) => lvl);
      lmsQuery = lmsQuery.in('dropout_risk_level', allowed);
    }

    const { data: lmsRows, error: lmsErr } = await lmsQuery;
    if (lmsErr) {
      res.status(500).json({ error: 'Failed to fetch risk data' });
      return;
    }

    if (!lmsRows || lmsRows.length === 0) {
      res.json({ cohort: [], count: 0 });
      return;
    }

    // 2. Join with users for name/branch/batch (and apply filters there)
    const studentIds = lmsRows.map((r: any) => r.student_id);
    let usersQuery = supabase
      .from('users')
      .select('id, full_name, roll_number, branch, batch')
      .eq('tenant_id', tenantId)
      .eq('role', 'student')
      .eq('is_active', true)
      .in('id', studentIds);

    if (typeof branch === 'string' && branch.length > 0) {
      usersQuery = usersQuery.eq('branch', branch);
    }
    if (typeof batch === 'string' && batch.length > 0) {
      usersQuery = usersQuery.eq('batch', batch);
    }

    const { data: users } = await usersQuery;
    const usersById = new Map((users ?? []).map((u: any) => [u.id, u]));

    const cohort = lmsRows
      .map((r: any) => {
        const u = usersById.get(r.student_id);
        if (!u) return null;
        return {
          student_id: r.student_id,
          full_name: u.full_name,
          roll_number: u.roll_number,
          branch: u.branch,
          batch: u.batch,
          attendance_pct: r.attendance_pct,
          assignment_completion_pct: r.assignment_completion_pct,
          dropout_risk_score: r.dropout_risk_score,
          dropout_risk_level: r.dropout_risk_level,
          dropout_risk_computed_at: r.dropout_risk_computed_at,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => (b.dropout_risk_score ?? 0) - (a.dropout_risk_score ?? 0));

    res.json({ cohort, count: cohort.length });
  } catch (err: any) {
    logger.error({ err }, 'GET /cohort-risk failed');
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

export default router;
