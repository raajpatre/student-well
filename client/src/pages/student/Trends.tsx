import React from 'react';
import { useApi } from '../../hooks/useApi';

interface TrendsData {
  checkin_history: {
    week_start: string;
    emotional_score: number | null;
    sleep_score: number | null;
    social_score: number | null;
  }[];
  streak: number;
}

const DIMS = [
  { key: 'emotional_score' as const, label: 'Mood' },
  { key: 'sleep_score' as const, label: 'Sleep' },
  { key: 'social_score' as const, label: 'Social' },
];

function getDotColor(val: number | null): string {
  if (val === null) return 'bg-surface-container-high';
  if (val >= 4) return 'bg-primary-container';
  if (val === 3) return 'bg-tertiary-container';
  return 'bg-surface-container-high';
}

function getLast12Weeks(): string[] {
  const weeks: string[] = [];
  const now = new Date();
  const day = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - day - 7 * 11);
  start.setHours(0, 0, 0, 0);
  for (let i = 0; i < 12; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i * 7);
    weeks.push(d.toISOString().split('T')[0]);
  }
  return weeks;
}

export const TrendsPage: React.FC = () => {
  const { data, isLoading } = useApi<TrendsData>('/api/student/trends');

  const weeks = getLast12Weeks();
  const historyMap = new Map(
    (data?.checkin_history || []).map((h) => [h.week_start.split('T')[0], h])
  );

  const streak = data?.streak ?? 0;

  return (
    <div className="flex flex-col gap-xl pb-8">
      {/* Page header */}
      <div>
        <h1 className="text-headline-md text-on-surface mb-1">My Trends</h1>
        <p className="text-[14px] text-outline">12-week view of your wellbeing</p>
      </div>

      {/* Section 1: Streak */}
      {!isLoading && (
        <section>
          <div className="bg-surface-container-lowest rounded-[18px] shadow-warm p-gutter flex items-center justify-between">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-serif-display text-[48px] leading-none text-primary">{streak}</span>
                <span className="text-2xl">🔥</span>
              </div>
              <span className="font-body-sm text-on-surface-variant mt-1">week streak</span>
            </div>
            <div className="flex gap-2 flex-wrap justify-end max-w-[160px]">
              {Array.from({ length: 8 }, (_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full ${i >= 8 - streak ? 'bg-primary-container' : 'bg-surface-container-high'}`}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Section 2: Check-in History Heatmap */}
      <section className="space-y-4">
        <h2 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">
          HOW YOU'VE BEEN
        </h2>
        {isLoading ? (
          <div className="bg-surface-container-lowest rounded-[16px] shadow-warm p-gutter h-[160px] animate-pulse" />
        ) : (
          <div className="bg-surface-container-lowest rounded-[16px] shadow-warm p-gutter overflow-x-auto no-scrollbar">
            <div style={{ minWidth: '400px' }}>
              {/* Week Labels */}
              <div className="grid gap-2 mb-4 text-[10px] text-on-surface-variant text-center" style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}>
                <div />
                {weeks.map((_, i) => (
                  <div key={i} className={i === 11 ? 'font-bold text-primary' : ''}>{i + 1}</div>
                ))}
              </div>

              {/* Grid Rows */}
              <div className="space-y-3">
                {DIMS.map(({ key, label }) => (
                  <div
                    key={key}
                    className="grid gap-2 items-center"
                    style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}
                  >
                    <span className="text-[10px] text-on-surface-variant text-right pr-2">{label}</span>
                    {weeks.map((w, i) => {
                      const entry = historyMap.get(w);
                      const val = entry?.[key] ?? null;
                      const isLast = i === 11;
                      return (
                        <div
                          key={w}
                          title={val !== null ? `Score: ${val}` : 'No check-in'}
                          className={`w-5 h-5 rounded-full mx-auto ${getDotColor(val)} ${isLast ? 'ring-2 ring-primary-container ring-offset-2 ring-offset-surface-container-lowest' : ''}`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="mt-6 flex items-center justify-center gap-4 text-[11px] text-on-surface-variant flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-primary-container" />Good
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-tertiary-container" />Okay
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-surface-container-high" />Low/Missed
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Section 3: Last 4 Weeks Bars */}
      <section className="space-y-4">
        <h2 className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest">
          LAST 4 WEEKS
        </h2>
        <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-warm">
          {isLoading ? (
            <div className="h-[100px] animate-pulse bg-surface-container-high rounded" />
          ) : (
            <div className="flex flex-col gap-4">
              {DIMS.map(({ key, label }) => {
                const last4 = weeks.slice(-4).map((w) => historyMap.get(w)?.[key] ?? null);
                return (
                  <div key={key}>
                    <div className="flex items-center gap-2 mb-2 text-[13px] text-on-surface-variant">
                      <span className="font-medium">{label}</span>
                    </div>
                    <div className="flex gap-2 items-end h-12">
                      {last4.map((val, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className={`w-full rounded-t-lg transition-all duration-500 ${getDotColor(val)}`}
                            style={{
                              height: val !== null ? `${(val / 5) * 44}px` : '6px',
                              minHeight: '6px',
                              opacity: val !== null ? 0.85 : 0.2,
                            }}
                          />
                          <span className="text-[10px] text-outline">W{i + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Privacy note */}
      <section>
        <div className="bg-surface-container-low rounded-[12px] p-4 flex gap-3 items-start border border-surface-container">
          <span className="material-symbols-outlined text-outline text-[20px]">info</span>
          <div className="flex-1">
            <p className="text-[12px] text-on-surface-variant leading-relaxed">This data is yours. Only you can see your trends.</p>
            <a href="/student/privacy" className="text-[12px] text-primary mt-1 inline-flex items-center gap-1 font-medium hover:opacity-80 transition-opacity">
              Manage privacy <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
            </a>
          </div>
        </div>
      </section>

      {!isLoading && (!data?.checkin_history || data.checkin_history.length === 0) && (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <span className="text-[40px]">📊</span>
          <p className="text-on-surface-variant">Complete your first check-in to start seeing trends here.</p>
        </div>
      )}
    </div>
  );
};
