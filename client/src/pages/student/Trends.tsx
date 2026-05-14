import React from 'react';
import { useApi } from '../../hooks/useApi';
import { Flame, Calendar } from 'lucide-react';

interface TrendsData {
  checkin_history: {
    week_start: string;
    emotional_score: number | null;
    sleep_score: number | null;
    social_score: number | null;
  }[];
  streak: number;
}

const SCORE_COLORS: Record<number, string> = {
  1: '#f97316',
  2: '#f59e0b',
  3: '#6b7280',
  4: '#22d3a0',
  5: '#7c6ff7',
};

const DIMS = [
  { key: 'emotional_score' as const, label: 'Emotional', emoji: '💙' },
  { key: 'sleep_score' as const, label: 'Rest', emoji: '🌙' },
  { key: 'social_score' as const, label: 'Social', emoji: '🤝' },
];

function scoreColor(val: number | null): string {
  if (val === null) return 'var(--surface-raised)';
  return SCORE_COLORS[Math.round(val)] || 'var(--surface-raised)';
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

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Your Trends</h1>
        <p style={{ color: 'var(--text-3)', fontSize: 14 }}>12-week view of your wellbeing</p>
      </div>

      {/* Streak */}
      {!isLoading && (
        <div className="card" style={{
          background: 'linear-gradient(135deg, rgba(124,111,247,0.15), rgba(34,211,160,0.08))',
          borderColor: 'var(--border-focus)',
          display: 'flex', alignItems: 'center', gap: 16
        }}>
          <div style={{ fontSize: 36 }}><Flame size={36} style={{ color: 'var(--warning)' }} /></div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>
              {data?.streak ?? 0}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 3 }}>
              week{(data?.streak ?? 0) === 1 ? '' : 's'} in a row
            </div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-3)' }}>
            Engagement streak
          </div>
        </div>
      )}

      {/* 12-Week Heatmap */}
      <div>
        <div className="section-header">
          <span className="section-title">Check-in Heatmap</span>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            <Calendar size={12} style={{ display: 'inline', marginRight: 4 }} />
            Last 12 weeks
          </span>
        </div>

        {isLoading ? (
          <div className="skeleton" style={{ height: 160, borderRadius: 'var(--radius-lg)' }} />
        ) : (
          <div className="card" style={{ padding: 16, overflowX: 'auto' }}>
            {/* Week labels */}
            <div style={{ display: 'grid', gridTemplateColumns: `80px repeat(12, 1fr)`, gap: 4, marginBottom: 8 }}>
              <div />
              {weeks.map((w) => (
                <div key={w} style={{ fontSize: 9, color: 'var(--text-3)', textAlign: 'center' }}>
                  {new Date(w).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                </div>
              ))}
            </div>

            {/* Rows */}
            {DIMS.map(({ key, label, emoji }) => (
              <div
                key={key}
                style={{ display: 'grid', gridTemplateColumns: `80px repeat(12, 1fr)`, gap: 4, marginBottom: 6 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-3)' }}>
                  <span>{emoji}</span>
                  <span>{label}</span>
                </div>
                {weeks.map((w) => {
                  const entry = historyMap.get(w);
                  const val = entry?.[key] ?? null;
                  return (
                    <div
                      key={w}
                      title={val !== null ? `Score: ${val}` : 'No check-in'}
                      style={{
                        height: 28, borderRadius: 6,
                        background: scoreColor(val),
                        opacity: val === null ? 0.25 : 0.85,
                        transition: 'transform 0.15s',
                        cursor: val !== null ? 'pointer' : 'default',
                      }}
                    />
                  );
                })}
              </div>
            ))}

            {/* Legend */}
            <div style={{ display: 'flex', gap: 12, marginTop: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {[
                { label: 'Low', color: '#f97316' },
                { label: 'Okay', color: '#6b7280' },
                { label: 'Good', color: '#22d3a0' },
                { label: 'Great', color: '#7c6ff7' },
              ].map(({ label, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: color }} />
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Score trend bars */}
      <div>
        <div className="section-header">
          <span className="section-title">Last 4 Weeks</span>
        </div>
        <div className="card" style={{ padding: 16 }}>
          {isLoading ? (
            <div className="skeleton" style={{ height: 100 }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {DIMS.map(({ key, label, emoji }) => {
                const last4 = weeks.slice(-4).map((w) => historyMap.get(w)?.[key] ?? null);
                return (
                  <div key={key}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 13 }}>
                      <span>{emoji}</span>
                      <span style={{ color: 'var(--text-2)' }}>{label}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 48 }}>
                      {last4.map((val, i) => (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <div style={{
                            width: '100%', height: val !== null ? `${(val / 5) * 44}px` : '6px',
                            background: scoreColor(val),
                            borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                            opacity: val !== null ? 0.85 : 0.2,
                            transition: 'height 0.5s ease',
                            minHeight: 6,
                          }} />
                          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>W{i + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {!isLoading && (!data?.checkin_history || data.checkin_history.length === 0) && (
        <div className="empty-state">
          <span style={{ fontSize: 40 }}>📊</span>
          <p>Complete your first check-in to start seeing trends here.</p>
        </div>
      )}
    </div>
  );
};
