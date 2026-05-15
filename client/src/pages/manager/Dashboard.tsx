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
  { key: 'total_active_students', label: 'Active Students', color: 'text-on-surface', valueColor: 'text-on-surface' },
  { key: 'new_flags_this_week', label: 'New Flags This Wk', color: 'text-on-surface', valueColor: 'text-terracotta' },
  { key: 'pending_assignments', label: 'Pending Assign.', color: 'text-on-surface', valueColor: 'text-terracotta' },
  { key: 'open_interventions', label: 'Open Interventions', color: 'text-on-surface', valueColor: 'text-sage-green' },
  { key: 'checkin_completion_rate', label: 'Check-in Rate', color: 'text-on-surface', valueColor: 'text-on-surface', suffix: '%' },
] satisfies ReadonlyArray<{ key: keyof DashboardStats; label: string; color: string; valueColor: string; suffix?: string }>;

function riskColor(count: number, total: number): string {
  if (total === 0) return 'bg-surface-container-low text-on-surface-variant';
  const pct = count / total;
  if (pct > 0.4) return 'bg-[#fdf1ea] text-terracotta';
  if (pct > 0.2) return 'bg-[#fff9e6] text-[#92660a]';
  if (pct > 0) return 'bg-[#f0f7f4] text-sage-dark';
  return 'bg-surface-container text-on-surface-variant';
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 shadow-warm text-[12px]">
      <p className="text-on-surface-variant mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-semibold">
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
    <div className="px-8 py-8 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="mb-xl">
        <h1 className="text-[22px] font-light text-on-surface mb-1">Overview</h1>
        <p className="text-[13px] text-text-muted-warm">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-xl">
        {STATS.map(({ key, label, valueColor, suffix }) => (
          <div key={key} className="bg-surface-container-lowest rounded-2xl p-md shadow-warm flex flex-col justify-between min-h-[90px]">
            <span className="text-label-caps text-text-muted-warm uppercase tracking-wider mb-2">{label}</span>
            {loadingStats
              ? <div className="h-8 w-16 rounded-md bg-surface-container animate-pulse" />
              : <span className={`text-[32px] font-light leading-none ${valueColor}`}>
                  {(stats as any)?.[key] ?? '—'}{suffix || ''}
                </span>
            }
          </div>
        ))}
      </div>

      {/* Two columns: Heatmap + Flag trend */}
      <div className="flex flex-col xl:flex-row gap-6 mb-xl">
        {/* Heatmap */}
        <div className="xl:w-[60%] bg-surface-container-lowest rounded-2xl p-lg shadow-warm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-[18px] font-normal text-on-surface">Batch Wellness Heatmap</h2>
            <span className="text-label-caps text-outline uppercase tracking-wider">By Branch / Batch</span>
          </div>
          {!heatmapData?.heatmap?.length ? (
            <p className="text-[13px] text-on-surface-variant py-8 text-center">No heatmap data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[400px]">
                <thead>
                  <tr>
                    <th className="text-label-caps text-text-muted-warm font-medium pb-3 uppercase">Batch</th>
                    <th className="text-label-caps text-text-muted-warm font-medium pb-3 text-center uppercase">Academic</th>
                    <th className="text-label-caps text-text-muted-warm font-medium pb-3 text-center uppercase">Emotional</th>
                    <th className="text-label-caps text-text-muted-warm font-medium pb-3 text-center uppercase">Social</th>
                  </tr>
                </thead>
                <tbody>
                  {heatmapData.heatmap.map(cell => (
                    <tr key={`${cell.branch}-${cell.batch}`} className="border-b border-border-light/50 last:border-0">
                      <td className="text-[14px] font-medium text-on-surface py-3">
                        {cell.branch} {cell.batch}
                        <span className="ml-2 text-[11px] text-text-muted-warm">({cell.total_students})</span>
                      </td>
                      {[
                        { count: cell.academic_risk_count },
                        { count: cell.emotional_risk_count },
                        { count: cell.social_risk_count },
                      ].map((dim, idx) => (
                        <td key={idx} className="py-3 text-center">
                          <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-[13px] font-medium mx-auto ${riskColor(dim.count, cell.total_students)}`}>
                            {dim.count}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Charts column */}
        <div className="xl:w-[40%] flex flex-col gap-4">
          {/* Flag trend */}
          <div className="bg-surface-container-lowest rounded-2xl p-lg shadow-warm flex-1">
            <h2 className="text-[16px] font-medium text-on-surface mb-4">Flags Raised · Last 8 Weeks</h2>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={report?.flag_trend || []} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E2D9" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#B0A89E' }} tickLine={false} axisLine={false}
                  tickFormatter={w => w.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: '#B0A89E' }} tickLine={false} axisLine={false} width={24} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Flags" fill="#D4956A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Engagement trend */}
          <div className="bg-surface-container-lowest rounded-2xl p-lg shadow-warm flex-1">
            <h2 className="text-[16px] font-medium text-on-surface mb-4">Check-in Engagement · Last 8 Weeks</h2>
            <ResponsiveContainer width="100%" height={130}>
              <LineChart data={report?.weekly_engagement || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E2D9" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#B0A89E' }} tickLine={false} axisLine={false}
                  tickFormatter={w => w.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: '#B0A89E' }} tickLine={false} axisLine={false}
                  width={30} unit="%" domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Line dataKey="rate" name="Completion" stroke="#7c9e8f" strokeWidth={2}
                  dot={{ r: 3, fill: '#7c9e8f' }} unit="%" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
