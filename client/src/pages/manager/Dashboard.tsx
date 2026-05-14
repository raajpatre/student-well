import React from 'react';
import { useApi } from '../../hooks/useApi';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts';

interface DashboardStats {
  total_active_students: number;
  new_flags_this_week: number;
  pending_assignments: number;
  open_interventions: number;
  checkin_completion_rate: number;
}

interface HeatmapCell {
  branch: string;
  batch: string;
  total_students: number;
  academic_risk_count: number;
  emotional_risk_count: number;
  social_risk_count: number;
}

interface SemesterReport {
  flag_trend: { week: string; count: number }[];
  weekly_engagement: { week: string; rate: number }[];
}

const STATS = [
  { key: 'total_active_students', label: 'Active Students', color: 'var(--sage)' },
  { key: 'new_flags_this_week', label: 'New Flags (Week)', color: '#f97316' },
  { key: 'pending_assignments', label: 'Pending Assign.', color: '#f59e0b' },
  { key: 'open_interventions', label: 'Open Cases', color: '#7c6ff7' },
  { key: 'checkin_completion_rate', label: 'Check-in Rate', color: '#22d3a0', suffix: '%' },
] satisfies ReadonlyArray<{ key: keyof DashboardStats; label: string; color: string; suffix?: string }>;

function riskColor(count: number, total: number): string {
  if (total === 0) return '#2a2c37';
  const pct = count / total;
  if (pct > 0.4) return '#f97316';
  if (pct > 0.2) return '#f59e0b';
  if (pct > 0) return '#22d3a0';
  return '#2a2c37';
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface-raised)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '8px 12px', fontSize: 12,
    }}>
      <p style={{ color: 'var(--text-3)', marginBottom: 4 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: {p.value}{p.unit || ''}
        </p>
      ))}
    </div>
  );
};

export const ManagerDashboard: React.FC = () => {
  const { data: stats, isLoading: loadingStats } = useApi<DashboardStats>('/api/manager/dashboard');
  const { data: heatmapData } = useApi<{ heatmap: HeatmapCell[] }>('/api/manager/heatmap');
  const { data: report } = useApi<SemesterReport>('/api/manager/reports/semester');

  return (
    <div className="fade-in">
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Overview</h1>
      <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 24 }}>
        {new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
      </p>

      {/* Stats strip */}
      <div className="mgr-stats-grid">
        {STATS.map(({ key, label, color, suffix }) => (
          <div key={key} className="mgr-stat-card" style={{ borderTop: `3px solid ${color}` }}>
            <div className="mgr-stat-label">{label}</div>
            {loadingStats
              ? <div className="skeleton" style={{ height: 36, width: 80, borderRadius: 6 }} />
              : <div className="mgr-stat-value" style={{ color }}>
                  {(stats as any)?.[key] ?? '—'}{suffix || ''}
                </div>
            }
          </div>
        ))}
      </div>

      {/* Grid: heatmap + charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>

        {/* Heatmap */}
        <div>
          <div className="mgr-section-title">Wellness Heatmap — by Branch / Batch</div>
          {!heatmapData?.heatmap?.length
            ? <p style={{ color: 'var(--text-3)', fontSize: 13 }}>No data yet.</p>
            : <div className="mgr-heatmap">
                {heatmapData.heatmap.map(cell => {
                  const maxRisk = Math.max(cell.academic_risk_count, cell.emotional_risk_count, cell.social_risk_count);
                  const topColor = riskColor(maxRisk, cell.total_students);
                  return (
                    <div key={`${cell.branch}-${cell.batch}`} className="heatmap-cell"
                      style={{ '--cell-color': topColor } as React.CSSProperties}>
                      <div className="heatmap-label">{cell.branch}</div>
                      <div className="heatmap-sub">Batch {cell.batch} · {cell.total_students} students</div>
                      <div className="heatmap-bars">
                        {[
                          { label: 'Acad', count: cell.academic_risk_count, color: '#7c6ff7' },
                          { label: 'Emot', count: cell.emotional_risk_count, color: '#f97316' },
                          { label: 'Social', count: cell.social_risk_count, color: '#22d3a0' },
                        ].map(({ label, count, color }) => (
                          <div key={label} className="heatmap-bar-row">
                            <span style={{ width: 38, flexShrink: 0 }}>{label}</span>
                            <div style={{ flex: 1, background: 'var(--border)', height: 5, borderRadius: 99 }}>
                              <div className="heatmap-bar-fill" style={{
                                background: color,
                                width: cell.total_students ? `${(count / cell.total_students) * 100}%` : '0%'
                              }} />
                            </div>
                            <span style={{ width: 18, textAlign: 'right' }}>{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
          }
        </div>

        {/* Charts column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Flag trend */}
          <div className="mgr-chart-wrap">
            <div className="mgr-chart-title">📊 Flags Raised — Last 8 Weeks</div>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={report?.flag_trend || []} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} axisLine={false}
                  tickFormatter={w => w.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} width={24} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Flags" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Engagement trend */}
          <div className="mgr-chart-wrap">
            <div className="mgr-chart-title">✅ Check-in Engagement — Last 8 Weeks</div>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={report?.weekly_engagement || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} axisLine={false}
                  tickFormatter={w => w.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} axisLine={false}
                  width={30} unit="%" domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Line dataKey="rate" name="Completion" stroke="#22d3a0" strokeWidth={2}
                  dot={{ r: 3, fill: '#22d3a0' }} unit="%" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
