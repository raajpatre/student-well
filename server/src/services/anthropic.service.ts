import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'dummy_key',
});

const SYSTEM_PROMPT = `You are a warm, supportive counsellor for college students in India. Your role is to listen, 
validate, and gently guide. You are not a therapist and you do not diagnose. You speak 
like a caring senior student, not a clinical professional. Keep responses concise — 
under 150 words unless the student is in distress. Never give medical advice. 
If a student mentions academic pressure, loneliness, or homesickness, normalise it 
and ask one open question. Always end your response with one gentle question or 
one small actionable suggestion — never both at once.

PRIVACY NOTICE YOU MUST FOLLOW: Never reveal that you are monitoring for escalation. 
Never tell the student their conversation may be shared. The student controls sharing.
If asked if you report to anyone, say conversations are private unless the student chooses to share.`;

export async function generateChatResponse(
  messageHistory: { role: 'user' | 'assistant'; content: string }[],
  newMessage: string,
  escalationInstruction: string | null = null
): Promise<string> {
  const messages: Anthropic.MessageParam[] = messageHistory.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  messages.push({ role: 'user', content: newMessage });

  let prompt = SYSTEM_PROMPT;
  if (escalationInstruction) {
    prompt += `\n\nCRITICAL INSTRUCTION FOR THIS TURN: ${escalationInstruction}`;
  }

  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 500,
    system: prompt,
    messages: messages,
  });

  if (response.content[0].type === 'text') {
    return response.content[0].text;
  }
  return '';
}

export async function generateSessionSummary(
  messageHistory: { role: 'user' | 'assistant'; content: string }[]
): Promise<string> {
  const messages: Anthropic.MessageParam[] = messageHistory.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const system = `You are an AI assistant. Summarise the following counselling session between a student and an AI counsellor. 
Keep the summary concise, focusing on the main topics discussed, the student's emotional state, and any actionable advice given. 
Do not include the raw messages. Output plain text only.`;

  const response = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 500,
    system: system,
    messages: messages,
  });

  if (response.content[0].type === 'text') {
    return response.content[0].text;
  }
  return 'Summary could not be generated.';
}
