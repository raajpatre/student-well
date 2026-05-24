// Adaptive question rotation.
//
// Looks at a student's recent weekly_reflections, finds the indicators that
// have been dominant (avg >= 60 across the last few weeks), and picks the
// adaptive_questions rows whose `triggers` intersect those indicators.
// Falls back to the highest-priority general questions when there isn't
// enough reflection history yet.

import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';

export interface AdaptiveQuestionRow {
  id: string;
  text: string;
  category: string;
  priority_weight: number;
  triggers: string[];
}

interface ReflectionRow {
  indicators: Record<string, number> | null;
}

const INDICATOR_KEYS = [
  'stress',
  'loneliness',
  'exhaustion',
  'motivationDecline',
  'anxiety',
  'sleepDecline',
] as const;

async function getDominantTriggers(studentId: string, tenantId: string): Promise<string[]> {
  const { data: reflections } = await supabase
    .from('weekly_reflections')
    .select('indicators')
    .eq('student_id', studentId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(4);

  if (!reflections || reflections.length === 0) return [];

  const totals: Record<string, number> = {};
  for (const row of reflections as ReflectionRow[]) {
    const ind = row.indicators ?? {};
    for (const key of INDICATOR_KEYS) {
      totals[key] = (totals[key] ?? 0) + Number(ind[key] ?? 0);
    }
  }

  return Object.entries(totals)
    .filter(([, sum]) => sum >= 60 * reflections.length / 2) // avg >= 30 across window — gentle threshold
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key)
    .slice(0, 3);
}

export async function getAdaptiveQuestions(
  studentId: string,
  tenantId: string,
  limit = 3,
): Promise<{ triggers: string[]; questions: AdaptiveQuestionRow[] }> {
  try {
    const triggers = await getDominantTriggers(studentId, tenantId);

    let query = supabase
      .from('adaptive_questions')
      .select('id, text, category, priority_weight, triggers')
      .eq('active', true)
      .order('priority_weight', { ascending: false })
      .limit(limit);

    if (triggers.length > 0) {
      query = query.overlaps('triggers', triggers);
    }

    const { data, error } = await query;

    if (error) {
      logger.error({ err: error, studentId }, 'Failed to fetch adaptive questions');
      return { triggers, questions: [] };
    }

    // If trigger filter produced too few, top up with general questions.
    if (data && data.length < limit && triggers.length > 0) {
      const { data: fallback } = await supabase
        .from('adaptive_questions')
        .select('id, text, category, priority_weight, triggers')
        .eq('active', true)
        .order('priority_weight', { ascending: false })
        .limit(limit);
      const seenIds = new Set(data.map((q) => q.id));
      const topUp = (fallback ?? []).filter((q) => !seenIds.has(q.id));
      return {
        triggers,
        questions: [...data, ...topUp].slice(0, limit) as AdaptiveQuestionRow[],
      };
    }

    return { triggers, questions: (data ?? []) as AdaptiveQuestionRow[] };
  } catch (err) {
    logger.error({ err, studentId }, 'getAdaptiveQuestions failed');
    return { triggers: [], questions: [] };
  }
}
