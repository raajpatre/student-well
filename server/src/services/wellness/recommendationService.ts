// Recommendation generator.
//
// Reads the student's latest wellness_signals (status per dimension) and the
// most recent weekly_reflections row (sentiment indicators) and produces
// 0–4 actionable suggestion cards. Cards are upserted into `recommendations`
// with status='active'. Existing active cards of the same type are deduped
// rather than piled on — the goal is one current card per topic.
//
// Trigger: called after a check-in submit (slice 1 hook) and from the
// passive sweep job. Pure-ish: reads two tables, writes one.

import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';

type RecommendationType =
  | 'self-care'
  | 'sleep'
  | 'social'
  | 'academic-balance'
  | 'counseling'
  | 'urgent-support';

type Priority = 'Low' | 'Moderate' | 'High' | 'Critical';

interface DraftRecommendation {
  type: RecommendationType;
  priority: Priority;
  message: string;
  source: 'wellness-score' | 'reflection' | 'social-isolation' | 'chatbot' | 'weekly-recap';
}

interface ReflectionRow {
  emotional_score: number | null;
  severity: string | null;
  indicators: Record<string, number> | null;
}

interface WellnessSignalsRow {
  academic_status: string | null;
  emotional_status: string | null;
  social_status: string | null;
}

function buildDrafts(
  signals: WellnessSignalsRow | null,
  reflection: ReflectionRow | null,
): DraftRecommendation[] {
  const drafts: DraftRecommendation[] = [];
  const ind = reflection?.indicators ?? {};
  const exhaustion = Number(ind.exhaustion ?? 0);
  const sleepDecline = Number(ind.sleepDecline ?? 0);
  const loneliness = Number(ind.loneliness ?? 0);
  const anxiety = Number(ind.anxiety ?? 0);
  const stress = Number(ind.stress ?? 0);
  const motivationDecline = Number(ind.motivationDecline ?? 0);

  // Sleep / exhaustion
  if (sleepDecline >= 50 || exhaustion >= 60) {
    drafts.push({
      type: 'sleep',
      priority: sleepDecline >= 70 || exhaustion >= 80 ? 'High' : 'Moderate',
      message:
        'Protect one recovery block today — sleep, a real meal, or a quiet no-task pause before more academic work.',
      source: 'reflection',
    });
  }

  // Social / loneliness
  if (loneliness >= 50 || signals?.social_status === 'risk') {
    drafts.push({
      type: 'social',
      priority: loneliness >= 70 ? 'High' : 'Moderate',
      message:
        'Try one low-pressure connection: a study group, campus event, peer mentor, or message to someone safe.',
      source: signals?.social_status === 'risk' ? 'wellness-score' : 'reflection',
    });
  }

  // Anxiety / stress → self-care
  if (anxiety >= 60 || stress >= 70) {
    drafts.push({
      type: 'self-care',
      priority: anxiety >= 70 ? 'High' : 'Moderate',
      message:
        'Use a short grounding routine and write down the next concrete action instead of holding every worry at once.',
      source: 'reflection',
    });
  }

  // Academic momentum
  if (signals?.academic_status === 'risk' || motivationDecline >= 60) {
    drafts.push({
      type: 'academic-balance',
      priority: signals?.academic_status === 'risk' ? 'High' : 'Moderate',
      message:
        'Pick the smallest next assignment and give it 20 focused minutes. Starting beats finishing for breaking the stuck loop.',
      source: signals?.academic_status === 'risk' ? 'wellness-score' : 'reflection',
    });
  }

  // Counseling threshold — driven by reflection severity OR emotional status risk
  const emotionalScore = reflection?.emotional_score ?? null;
  const severity = reflection?.severity ?? null;
  const isCritical = severity === 'Critical' || (emotionalScore !== null && emotionalScore < 25);
  const isHigh = severity === 'High' || (emotionalScore !== null && emotionalScore < 40) || signals?.emotional_status === 'risk';

  if (isCritical) {
    drafts.push({
      type: 'urgent-support',
      priority: 'Critical',
      message:
        'You deserve real-time human support. Please reach out to campus counseling, a trusted person, or emergency services today.',
      source: 'reflection',
    });
  } else if (isHigh) {
    drafts.push({
      type: 'counseling',
      priority: 'High',
      message:
        'Consider contacting campus counseling or a trusted staff member for human support this week.',
      source: severity ? 'reflection' : 'wellness-score',
    });
  }

  return drafts;
}

/**
 * Refreshes the active recommendation set for a student.
 * Dedupe rule: for each `type`, at most one row with status='active' is kept;
 * older entries of the same type are dismissed with status='dismissed'.
 */
export async function generateRecommendationsForStudent(
  studentId: string,
  tenantId: string,
): Promise<void> {
  try {
    const [signalsRes, reflectionRes] = await Promise.all([
      supabase
        .from('wellness_signals')
        .select('academic_status, emotional_status, social_status')
        .eq('student_id', studentId)
        .eq('tenant_id', tenantId)
        .maybeSingle(),
      supabase
        .from('weekly_reflections')
        .select('emotional_score, severity, indicators')
        .eq('student_id', studentId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const drafts = buildDrafts(
      signalsRes.data as WellnessSignalsRow | null,
      reflectionRes.data as ReflectionRow | null,
    );

    if (drafts.length === 0) {
      // Nothing to recommend — dismiss any stale actives so the student isn't
      // confronted with last week's prompts.
      await supabase
        .from('recommendations')
        .update({ status: 'dismissed', dismissed_at: new Date().toISOString() })
        .eq('student_id', studentId)
        .eq('tenant_id', tenantId)
        .eq('status', 'active');
      return;
    }

    const draftTypes = drafts.map((d) => d.type);

    // Dismiss active recommendations of any type NOT in the new draft set.
    await supabase
      .from('recommendations')
      .update({ status: 'dismissed', dismissed_at: new Date().toISOString() })
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .not('type', 'in', `(${draftTypes.map((t) => `"${t}"`).join(',')})`);

    // For each draft type, dismiss prior active rows then insert fresh.
    for (const draft of drafts) {
      await supabase
        .from('recommendations')
        .update({ status: 'dismissed', dismissed_at: new Date().toISOString() })
        .eq('student_id', studentId)
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .eq('type', draft.type);

      await supabase.from('recommendations').insert({
        tenant_id: tenantId,
        student_id: studentId,
        type: draft.type,
        priority: draft.priority,
        message: draft.message,
        source: draft.source,
        status: 'active',
      });
    }
  } catch (err) {
    logger.error({ err, studentId }, 'Failed to generate recommendations');
  }
}
