import React from 'react';
import { useApi } from '../../hooks/useApi';
import { Printer } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';

interface SemesterReport {
  total_flagged: number;
  flags_by_dimension: Record<string, number>;
  avg_time_to_first_contact_hours: number | null;
  resolution_rate: number;
  weekly_engagement: { week: string; rate: number; students_checked_in: number }[];
  flag_trend: { week: string; count: number }[];
}

const COLORS = ['#7c6ff7', '#f97316', '#22d3a0', '#f59e0b', '#60a5fa'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface-raised)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '8px 12px', fontSize: 12,
    }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color || p.fill, fontWeight: 600 }}>
          {p.name}: {p.value}{p.unit || ''}
        </p>
      ))}
    </div>
  );
};

const StatBox: React.FC<{ label: string; value: string | number; sub?: string; color?: string }> = ({ label, value, sub, color }) => (
  <div style={{
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: '18px 20px',
  }}>
    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 8 }}>{label}</div>
    <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1px', color: color || 'var(--text)' }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
  </div>
);

export const ReportsPage: React.FC = () => {
  const { data: report, isLoading } = useApi<SemesterReport>('/api/manager/reports/semester');

  const dimensionData = report
    ? Object.entries(report.flags_by_dimension).map(([name, value]) => ({ name, value }))
    : [];

  const handlePrint = () => window.print();

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }} className="no-print">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Semester Report</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Aggregate data for the last 12 weeks</p>
        </div>
        <button className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={handlePrint}>
          <Printer size={15} /> Export / Print
        </button>
      </div>

      {/* Print header (only visible in print) */}
      <div style={{ display: 'none' }} className="print-only">
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>StudentWell — Semester Report</h1>
        <p style={{ color: '#666', marginBottom: 20 }}>Generated {new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}</p>
      </div>

      {isLoading
        ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 12 }} />)}
          </div>
        )
        : report && (
          <>
            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
              <StatBox label="Total Flagged" value={report.total_flagged} sub="last 12 weeks" color="#f97316" />
              <StatBox
                label="Avg. Time to Contact"
                value={report.avg_time_to_first_contact_hours != null
                  ? report.avg_time_to_first_contact_hours < 24
                    ? `${report.avg_time_to_first_contact_hours}h`
                    : `${Math.round(report.avg_time_to_first_contact_hours / 24)}d`
                  : '—'}
                sub="from assignment to first contact"
                color="var(--accent)"
              />
              <StatBox label="Resolution Rate" value={`${report.resolution_rate}%`} sub="of closed cases" color="#22d3a0" />
              <StatBox
                label="Avg. Engagement"
                value={report.weekly_engagement.length
                  ? `${Math.round(report.weekly_engagement.reduce((s, w) => s + w.rate, 0) / report.weekly_engagement.length)}%`
                  : '—'}
                sub="weekly check-in rate"
                color="#f59e0b"
              />
            </div>

            {/* Charts row 1 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

              {/* Flag trend bar chart */}
              <div className="mgr-chart-wrap">
                <div className="mgr-chart-title">📊 Flags Raised Per Week</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={report.flag_trend} barSize={16}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false}
                      tickFormatter={w => w.slice(5)} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} width={24} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Flags" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Dimension breakdown pie */}
              <div className="mgr-chart-wrap">
                <div className="mgr-chart-title">🎯 Flags by Dimension</div>
                {dimensionData.length === 0
                  ? <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: 20 }}>No flag data yet.</p>
                  : (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={dimensionData} cx="50%" cy="50%" outerRadius={75} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`} labelLine={false}>
                          {dimensionData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )
                }
              </div>
            </div>

            {/* Engagement trend */}
            <div className="mgr-chart-wrap" style={{ marginBottom: 16 }}>
              <div className="mgr-chart-title">✅ Weekly Check-in Engagement Rate</div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={report.weekly_engagement}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false}
                    tickFormatter={w => w.slice(5)} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false}
                    width={34} unit="%" />
                  <Tooltip content={<CustomTooltip />} />
                  <Line dataKey="rate" name="Check-in Rate" stroke="#22d3a0" strokeWidth={2.5}
                    dot={{ r: 4, fill: '#22d3a0' }} unit="%" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Dimension breakdown table */}
            {dimensionData.length > 0 && (
              <div className="mgr-table-wrap">
                <table className="mgr-table">
                  <thead>
                    <tr>
                      <th>Dimension</th>
                      <th>Times Triggered</th>
                      <th>Share</th>
                      <th>Visual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dimensionData.sort((a, b) => b.value - a.value).map((d, i) => {
                      const total = dimensionData.reduce((s, x) => s + x.value, 0);
                      const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
                      return (
                        <tr key={d.name} onClick={() => {}}>
                          <td style={{ textTransform: 'capitalize', fontWeight: 500 }}>{d.name}</td>
                          <td style={{ fontWeight: 700 }}>{d.value}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{pct}%</td>
                          <td>
                            <div style={{ background: 'var(--border)', height: 6, borderRadius: 99, width: 120 }}>
                              <div style={{ height: '100%', borderRadius: 99, width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )
      }
    </div>
  );
};
