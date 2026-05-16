import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { apiCall } from '../../lib/api';
import { StatusBadge } from '../../components/student/StatusBadge';

interface Recommendation {
  id: string;
  type: 'self-care' | 'sleep' | 'social' | 'academic-balance' | 'counseling' | 'urgent-support';
  priority: 'Low' | 'Moderate' | 'High' | 'Critical';
  message: string;
  source: string;
  created_at: string;
}

const RECOMMENDATION_ICON: Record<Recommendation['type'], string> = {
  'self-care': 'spa',
  sleep: 'bedtime',
  social: 'group',
  'academic-balance': 'school',
  counseling: 'volunteer_activism',
  'urgent-support': 'crisis_alert',
};

const PRIORITY_ACCENT: Record<Recommendation['priority'], string> = {
  Low: 'border-l-primary-container',
  Moderate: 'border-l-primary-container',
  High: 'border-l-tertiary',
  Critical: 'border-l-error',
};

interface WellnessSignals {
  academic_status: string | null;
  emotional_status: string | null;
  social_status: string | null;
  academic_score: number | null;
  emotional_score: number | null;
  social_score: number | null;
  academic_suggestion: string | null;
  emotional_suggestion: string | null;
  social_suggestion: string | null;
  last_updated: string | null;
}

interface CheckinStatus {
  pending: boolean;
  last_checkin: string | null;
}

interface StudentInfo {
  counsellor_id: string | null;
  flag_status: string | null;
  wellness_signals: WellnessSignals | null;
}

const WELLNESS_CARDS = [
  {
    key: 'academic' as const,
    label: 'Academic Momentum',
    icon: 'school',
    statusKey: 'academic_status' as const,
    scoreKey: 'academic_score' as const,
    suggestionKey: 'academic_suggestion' as const,
    borderColor: 'border-l-primary-container',
    iconBg: 'bg-surface-container-low text-primary',
    isFilled: false,
  },
  {
    key: 'emotional' as const,
    label: 'Emotional Baseline',
    icon: 'favorite',
    statusKey: 'emotional_status' as const,
    scoreKey: 'emotional_score' as const,
    suggestionKey: 'emotional_suggestion' as const,
    borderColor: 'border-l-tertiary',
    iconBg: 'bg-terracotta-light text-tertiary',
    isFilled: true,
  },
  {
    key: 'social' as const,
    label: 'Social Connection',
    icon: 'groups',
    statusKey: 'social_status' as const,
    scoreKey: 'social_score' as const,
    suggestionKey: 'social_suggestion' as const,
    borderColor: 'border-l-primary-container',
    iconBg: 'bg-surface-container-low text-primary',
    isFilled: false,
  },
];

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'No data yet';
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function getStatusBadgeClasses(status: string | null | undefined): string {
  if (!status) return 'bg-surface-container text-on-surface-variant';
  const s = status.toLowerCase();
  if (s.includes('good') || s.includes('well')) return 'bg-primary-fixed/30 text-on-primary-container';
  if (s.includes('care') || s.includes('check') || s.includes('support')) return 'bg-tertiary-fixed-dim/30 text-on-tertiary-container';
  return 'bg-surface-container text-on-surface-variant';
}

function getStatusLabel(status: string | null | undefined): string {
  if (!status) return 'No data';
  const s = status.toLowerCase();
  if (s === 'good') return 'Doing Well';
  if (s === 'check_in' || s === 'check-in') return 'Check In';
  if (s === 'support') return 'Needs Care';
  return status;
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: studentInfo, isLoading: loadingInfo } = useApi<StudentInfo>('/api/student/me');
  const { data: checkinStatus, isLoading: loadingCheckin } = useApi<CheckinStatus>('/api/checkins/status');
  const { data: recsResp } = useApi<{ recommendations: Recommendation[] }>('/api/student/recommendations');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const signals = studentInfo?.wellness_signals;
  const hasPendingCheckin = checkinStatus?.pending;
  const showCounsellorBanner =
    studentInfo?.counsellor_id && studentInfo?.flag_status === 'pending_contact';

  const isLoading = loadingInfo || loadingCheckin;
  const visibleRecs = (recsResp?.recommendations ?? []).filter((r) => !dismissed.has(r.id));

  const dismissRecommendation = async (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
    try {
      await apiCall(`/api/student/recommendations/${id}`, {
        method: 'PATCH',
        body: { status: 'dismissed' },
      });
    } catch {
      // Optimistic — leave it dismissed in the UI even if the request fails.
    }
  };

  return (
    <div className="flex flex-col gap-xl">
      {/* Counsellor Banner */}
      {showCounsellorBanner && (
        <div className="bg-primary-fixed/30 border border-primary-container/30 rounded-2xl px-4 py-3 flex items-start gap-3">
          <span className="material-symbols-outlined text-primary text-[18px] mt-0.5">notifications</span>
          <p className="text-[14px] text-on-surface leading-relaxed">
            Someone from the support team will be in touch with you soon. You're not alone in this.
          </p>
        </div>
      )}

      {/* Section 1: Quote Hero Card */}
      <section className="w-full">
        <div className="bg-surface-container-lowest rounded-2xl shadow-warm overflow-hidden relative p-6 pt-8">
          {/* Top gradient line */}
          <div className="absolute top-0 left-0 w-full h-[3px] quote-gradient" />
          {/* Decorative Quote Mark */}
          <div className="absolute top-4 left-4 font-serif-display text-6xl text-primary-fixed-dim opacity-40 leading-none select-none">"</div>
          <div className="relative z-10 text-center mt-2">
            <p className="font-serif-display italic text-[19px] text-on-surface leading-relaxed">
              You don't have to be extraordinary every day. Showing up is enough.
            </p>
            <p className="font-label-caps text-label-caps text-on-surface-variant mt-4 tracking-widest uppercase">
              — StudentWell
            </p>
          </div>
          {/* Indicators */}
          <div className="flex justify-center items-center gap-2 mt-6">
            <div className="w-4 h-1.5 rounded-full bg-primary-container" />
            <div className="w-1.5 h-1.5 rounded-full bg-surface-variant" />
            <div className="w-1.5 h-1.5 rounded-full bg-surface-variant" />
          </div>
        </div>
      </section>

      {/* Section 2: Quick Actions */}
      <section className="w-full flex flex-col gap-4">
        <h2 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest pl-1 uppercase">
          QUICK ACCESS
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {/* Card 1: Talk to Counsellor */}
          <button
            className="bg-surface-container-lowest rounded-2xl p-4 flex flex-col items-center text-center shadow-warm border border-surface-variant/50 relative hover:bg-surface-container-low transition-colors group"
            onClick={() => navigate('/student/chat')}
          >
            <div className="w-12 h-12 rounded-full bg-terracotta-light flex items-center justify-center text-tertiary mb-3 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined">chat_bubble</span>
            </div>
            <span className="font-body-sm text-[12px] leading-tight text-on-surface h-8 flex items-center">Talk to Counsellor</span>
            <span className="text-[10px] text-on-surface-variant mt-1">Always here</span>
          </button>

          {/* Card 2: Weekly Check-in */}
          <button
            className="bg-surface-container-lowest rounded-2xl p-4 flex flex-col items-center text-center shadow-warm border border-surface-variant/50 relative hover:bg-surface-container-low transition-colors group"
            onClick={() => navigate('/student/checkin')}
          >
            {hasPendingCheckin && (
              <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-tertiary animate-pulse opacity-70" />
            )}
            <div className="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center text-primary-container mb-3 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined">self_improvement</span>
            </div>
            <span className="font-body-sm text-[12px] leading-tight text-on-surface h-8 flex items-center">Weekly Check-in</span>
            <span className={`text-[10px] mt-1 ${hasPendingCheckin ? 'text-tertiary' : 'text-on-surface-variant'}`}>
              {hasPendingCheckin ? 'Pending' : 'Done'}
            </span>
          </button>

          {/* Card 3: Find Your People */}
          <button
            className="bg-surface-container-lowest rounded-2xl p-4 flex flex-col items-center text-center shadow-warm border border-surface-variant/50 hover:bg-surface-container-low transition-colors group"
            onClick={() => navigate('/student/spaces')}
          >
            <div className="w-12 h-12 rounded-full bg-indigo-light flex items-center justify-center text-primary mb-3 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined">group</span>
            </div>
            <span className="font-body-sm text-[12px] leading-tight text-on-surface h-8 flex items-center">Find Your People</span>
            <span className="text-[10px] text-on-surface-variant mt-1">Spaces</span>
          </button>
        </div>
      </section>

      {/* Section 2b: FOR YOU — actionable recommendation cards */}
      {visibleRecs.length > 0 && (
        <section className="w-full flex flex-col gap-4">
          <h2 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest pl-1 uppercase">
            FOR YOU
          </h2>
          <div className="flex flex-col gap-3">
            {visibleRecs.map((rec) => (
              <div
                key={rec.id}
                className={`bg-surface-container-lowest rounded-2xl p-4 shadow-warm border-l-[3px] ${PRIORITY_ACCENT[rec.priority]} flex items-start gap-4`}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-1 bg-surface-container-low text-primary">
                  <span className="material-symbols-outlined text-[20px]">
                    {RECOMMENDATION_ICON[rec.type]}
                  </span>
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <p className="text-[14px] text-on-surface leading-relaxed">{rec.message}</p>
                  {rec.type === 'urgent-support' && (
                    <button
                      onClick={() => navigate('/student/chat')}
                      className="self-start mt-1 text-[12px] text-primary font-medium hover:underline"
                    >
                      Talk to someone now →
                    </button>
                  )}
                </div>
                <button
                  aria-label="Dismiss"
                  onClick={() => { void dismissRecommendation(rec.id); }}
                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-container-low transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px] text-outline">close</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section 3: YOUR PULSE TODAY */}
      <section className="w-full flex flex-col gap-4 pb-8">
        <div className="flex items-center justify-between">
          <h2 className="font-label-caps text-label-caps text-on-surface-variant tracking-widest pl-1 uppercase">
            YOUR PULSE TODAY
          </h2>
          {signals?.last_updated && (
            <span className="text-[11px] text-outline">Updated {timeAgo(signals.last_updated)}</span>
          )}
        </div>
        <div className="flex flex-col gap-3">
          {isLoading
            ? [1, 2, 3].map((i) => (
                <div key={i} className="bg-surface-container-lowest rounded-2xl h-[88px] animate-pulse" />
              ))
            : WELLNESS_CARDS.map(({ key, label, icon, statusKey, suggestionKey, borderColor, iconBg, isFilled }) => (
                <div
                  key={key}
                  className={`bg-surface-container-lowest rounded-2xl p-4 shadow-warm border-l-[3px] ${borderColor} flex items-start gap-4 hover:shadow-warm-glow transition-shadow cursor-pointer`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-1 ${iconBg}`}>
                    <span
                      className="material-symbols-outlined text-[20px]"
                      style={isFilled ? { fontVariationSettings: "'FILL' 1" } : undefined}
                    >
                      {icon}
                    </span>
                  </div>
                  <div className="flex-1 flex flex-col gap-1">
                    <div className="flex justify-between items-start">
                      <h3 className="font-body-sm text-[15px] text-on-surface">{label}</h3>
                      {signals?.[statusKey] ? (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${getStatusBadgeClasses(signals[statusKey])}`}>
                          {getStatusLabel(signals[statusKey])}
                        </span>
                      ) : (
                        <StatusBadge status={signals?.[statusKey] as any} />
                      )}
                    </div>
                    {signals?.[suggestionKey] ? (
                      <p className="text-[13px] text-on-surface-variant leading-relaxed">{signals[suggestionKey]}</p>
                    ) : !signals ? (
                      <p className="text-[13px] text-on-surface-variant">
                        Complete your first check-in to see insights here.
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
        </div>
      </section>
    </div>
  );
};
