// SECURITY: using Supabase client — parameterized queries, no raw SQL concatenation
import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { authMiddleware } from '../middleware/auth';
import { getChatModel, getSummaryModel } from '../services/geminiClient';
import { detectEscalation } from '../services/escalationDetector';
import { validateBody } from '../middleware/validateBody';
import { chatMessageLimiter } from '../middleware/rateLimiters';
import { chatMessageSchema, shareSessionSchema } from '../validators/chat.validators';
import { logger } from '../lib/logger';

const router = Router();

// Apply auth middleware to all routes in this file
router.use(authMiddleware);

// Ensure only students can access these routes
const studentOnly = (req: Request, res: Response, next: any) => {
  if (req.user?.role !== 'student') {
    res.status(403).json({ error: 'Access denied: Students only' });
    return;
  }
  next();
};
router.use(studentOnly);

// Guard against prompt injection
const INJECTION_PATTERNS = [
  /ignore previous instructions/i,
  /you are now/i,
  /new system prompt/i,
  /system override/i
];

router.post('/message', chatMessageLimiter, validateBody(chatMessageSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { message } = req.body;
    let { session_id } = req.body;
    const studentId = req.user!.id;
    const tenantId = req.user!.tenant_id;

    // Limit length to 2000 chars to prevent context flooding
    const truncatedMessage = message.substring(0, 2000);

    // Prompt injection check
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(truncatedMessage)) {
        await supabase.from('audit_logs').insert({
          tenant_id: tenantId,
          actor_id: studentId,
          action: 'prompt_injection_attempt',
          metadata: { session_id }
        });
        
        res.json({
          session_id: session_id || null,
          message: "I understand you'd like me to act differently, but I'm here to support you as a counsellor. How are you feeling today?",
          escalation_level: null
        });
        return;
      }
    }

    // If no session exists, create one
    if (!session_id) {
      const { data: newSession, error: sessErr } = await supabase
        .from('chatbot_sessions')
        .insert({
          tenant_id: tenantId,
          student_id: studentId
        })
        .select('id')
        .single();
        
      if (sessErr || !newSession) {
        throw new Error('Failed to create chat session');
      }
      session_id = newSession.id;
    } else {
      // Verify session belongs to student
      const { data: session } = await supabase
        .from('chatbot_sessions')
        .select('student_id')
        .eq('id', session_id)
        .eq('tenant_id', tenantId)
        .single();
        
      if (!session || session.student_id !== studentId) {
        res.status(403).json({ error: 'Invalid session' });
        return;
      }
    }

    // Fetch last 20 messages for context
    const { data: history } = await supabase
      .from('chatbot_messages')
      .select('role, content')
      .eq('session_id', session_id)
      .eq('tenant_id', tenantId)
      .order('sent_at', { ascending: true })
      .limit(20);

    const messageHistory = history || [];

    // Format for Gemini
    const formattedHistory = messageHistory.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    // Save user message to DB (Do this before detecting escalation so logic is identical)
    await supabase.from('chatbot_messages').insert({
      session_id,
      tenant_id: tenantId,
      role: 'user',
      content: truncatedMessage
    });

    // Detect escalation (on raw message)
    const escalationLevel = await detectEscalation(
      truncatedMessage, 
      messageHistory as { role: string; content: string }[], 
      session_id, 
      studentId, 
      tenantId
    );

    let escalationInstruction = "";
    if (escalationLevel === 1) {
      escalationInstruction = "\n\nCRITICAL INSTRUCTION FOR THIS TURN: The student seems distressed. In your response, gently ask if they would like to be connected with a real human counsellor.";
    } else if (escalationLevel === 2) {
      escalationInstruction = "\n\nCRITICAL INSTRUCTION FOR THIS TURN: The student has expressed intent to self-harm. You must include the following crisis helplines in your response: iCall (9152987821) and Vandrevala Foundation (1860-2662-345). Be extremely empathetic.";
    } else if (escalationLevel === 3) {
      escalationInstruction = "\n\nCRITICAL INSTRUCTION FOR THIS TURN: The student is in an active emergency. Lead with crisis resources (iCall: 9152987821) and ask directly: 'Are you safe right now?'";
    }

    // Call Gemini API
    const model = getChatModel();
    const chat = model.startChat({ history: formattedHistory });
    
    let result;
    try {
      result = await chat.sendMessage(truncatedMessage + escalationInstruction);
    } catch (apiError: any) {
      if (apiError.status === 429) {
        res.json({
          session_id,
          message: "I'm a little busy right now — try again in a minute.",
          escalation_level: escalationLevel
        });
        return;
      }
      throw apiError;
    }

    // Safety check
    if (result.response.candidates && result.response.candidates.length > 0) {
      const candidate = result.response.candidates[0];
      if (candidate.finishReason === 'SAFETY') {
        await supabase.from('audit_logs').insert({
          tenant_id: tenantId,
          actor_id: studentId,
          action: 'gemini_safety_block',
          metadata: { session_id }
        });
        
        res.json({
          session_id,
          message: "I want to make sure I respond thoughtfully. Could you tell me a bit more about what's on your mind?",
          escalation_level: escalationLevel
        });
        return;
      }
    }

    const assistantResponse = result.response.text();

    // Save assistant response
    await supabase.from('chatbot_messages').insert({
      session_id,
      tenant_id: tenantId,
      role: 'assistant',
      content: assistantResponse
    });

    res.json({
      session_id,
      message: assistantResponse,
      escalation_level: escalationLevel
    });

  } catch (error: any) {
    logger.error({ err: error }, 'Chat message error');
    res.status(500).json({ error: 'Failed to process message' });
  }
});

router.get('/sessions', async (req: Request, res: Response): Promise<void> => {
  const studentId = req.user!.id;
  const tenantId = req.user!.tenant_id;

  const { data, error } = await supabase
    .from('chatbot_sessions')
    .select('id, started_at, ended_at, escalation_level, student_shared')
    .eq('student_id', studentId)
    .eq('tenant_id', tenantId)
    .order('started_at', { ascending: false });

  if (error) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
    return;
  }

  res.json({ sessions: data });
});

router.get('/sessions/:session_id/messages', async (req: Request, res: Response): Promise<void> => {
  const { session_id } = req.params;
  const studentId = req.user!.id;
  const tenantId = req.user!.tenant_id;

  // Verify ownership
  const { data: session } = await supabase
    .from('chatbot_sessions')
    .select('student_id')
    .eq('id', session_id)
    .eq('tenant_id', tenantId)
    .single();

  if (!session || session.student_id !== studentId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const { data: messages, error } = await supabase
    .from('chatbot_messages')
    .select('id, role, content, sent_at')
    .eq('session_id', session_id)
    .eq('tenant_id', tenantId)
    .order('sent_at', { ascending: true });

  if (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
    return;
  }

  res.json({ messages });
});

router.post('/sessions/:session_id/share', validateBody(shareSessionSchema), async (req: Request, res: Response): Promise<void> => {
  const { session_id } = req.params;
  const studentId = req.user!.id;
  const tenantId = req.user!.tenant_id;

  // Verify ownership
  const { data: session } = await supabase
    .from('chatbot_sessions')
    .select('student_id, student_shared')
    .eq('id', session_id)
    .eq('tenant_id', tenantId)
    .single();

  if (!session || session.student_id !== studentId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  if (session.student_shared) {
    res.status(400).json({ error: 'Session already shared' });
    return;
  }

  // Fetch history to generate summary
  const { data: messages } = await supabase
    .from('chatbot_messages')
    .select('role, content')
    .eq('session_id', session_id)
    .eq('tenant_id', tenantId)
    .order('sent_at', { ascending: true });

  if (!messages || messages.length === 0) {
    res.status(400).json({ error: 'Cannot share an empty session' });
    return;
  }

  // Format full conversation into string
  const conversationText = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');

  try {
    const model = getSummaryModel();
    const prompt = `Summarise this counselling conversation in 3-4 sentences. 
Focus on what the student was feeling and what was discussed. 
Do not include any specific personal details. Be warm and clinical-neutral.
Conversation: ${conversationText}`;

    const result = await model.generateContent(prompt);
    
    // Check safety
    if (result.response.candidates && result.response.candidates.length > 0 && result.response.candidates[0].finishReason === 'SAFETY') {
        res.status(500).json({ error: 'Summary generation failed due to safety settings.' });
        return;
    }
    
    const summary = result.response.text();

    const { error } = await supabase
      .from('chatbot_sessions')
      .update({ 
        student_shared: true,
        shared_summary: summary 
      })
      .eq('id', session_id);

    if (error) {
      res.status(500).json({ error: 'Failed to share session' });
      return;
    }

    res.json({ success: true, summary });
  } catch (error) {
    logger.error({ err: error }, 'Summary generation error');
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

export default router;
