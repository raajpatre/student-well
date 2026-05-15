import React from 'react';
import { useApi } from '../../hooks/useApi';
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

const COLORS = ['#bb8b88', '#7c9e8f', '#D4956A', '#456558', '#85522d'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2 shadow-warm text-[12px]">
      <p className="text-on-surface-variant mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color || p.fill }} className="font-semibold">
          {p.name}: {p.value}{p.unit || ''}
        </p>
      ))}
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string | number; icon?: string; iconColor?: string; sub?: string }> = ({
  label, value, icon, iconColor, sub
}) => (
  <div className="bg-surface-container-lowest rounded-card p-lg shadow-warm border border-outline-variant/20 flex flex-col gap-xs">
    <span className="text-label-caps text-on-surface-variant uppercase tracking-wider">{label}</span>
    <div className="flex items-baseline gap-xs">
      <span className="text-[32px] font-light leading-none text-primary">{value}</span>
      {icon && (
        <span className="material-symbols-outlined" style={{ fontSize: '20px', color: iconColor || '#7d5451' }}>{icon}</span>
      )}
    </div>
    {sub && <span className="text-[12px] text-on-surface-variant">{sub}</span>}
  </div>
);

export const ReportsPage: React.FC = () => {
  const { data: report, isLoading } = useApi<SemesterReport>('/api/manager/reports/semester');

  const dimensionData = report
    ? Object.entries(report.flags_by_dimension).map(([name, value]) => ({ name, value }))
    : [];

  const handlePrint = () => window.print();

  const avgContactDisplay = report?.avg_time_to_first_contact_hours != null
    ? report.avg_time_to_first_contact_hours < 24
      ? `${report.avg_time_to_first_contact_hours}h`
      : `${Math.round(report.avg_time_to_first_contact_hours / 24)}`
    : '—';

  const avgEngagement = report?.weekly_engagement?.length
    ? `${Math.round(report.weekly_engagement.reduce((s, w) => s + w.rate, 0) / report.weekly_engagement.length)}%`
    : '—';

  return (
    <div className="px-8 py-8 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-xl no-print">
        <div>
          <h1 className="text-[22px] font-light text-on-surface mb-1">Semester Report</h1>
          <p className="text-[13px] text-on-surface-variant">Aggregate data for the last 12 weeks</p>
        </div>
        <div className="flex items-center gap-md">
          <div className="relative">
            <select className="appearance-none bg-surface-container-lowest border border-outline-variant/50 rounded-lg px-md py-xs pr-8 text-[14px] text-on-surface focus:outline-none focus:border-primary cursor-pointer">
              <option>Semester 2 (Current)</option>
              <option>Semester 1</option>
              <option>Last Year</option>
            </select>
            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant" style={{ fontSize: '18px' }}>expand_more</span>
          </div>
          <button
            onClick={handlePrint}
            className="flex items-center gap-xs px-md py-xs rounded-lg border border-outline-variant/50 text-secondary hover:bg-surface-container-low transition-colors text-[14px] font-medium"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>download</span>
            Export PDF
          </button>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print-only">
        <h1 className="text-[24px] font-medium text-on-surface mb-1">StudentWell — Semester Report</h1>
        <p className="text-on-surface-variant mb-5">Generated {new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-md mb-xl">
          {[1,2,3,4].map(i => <div key={i} className="h-24 rounded-card bg-surface-container animate-pulse" />)}
        </div>
      ) : report && (
        <div className="flex flex-col gap-xl">
          {/* KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-md">
            <StatCard label="Total Flagged" value={report.total_flagged} icon="warning" iconColor="#7d5451" sub="last 12 weeks" />
            <StatCard
              label="Avg Time to Contact"
              value={avgContactDisplay}
              sub={report.avg_time_to_first_contact_hours != null && report.avg_time_to_first_contact_hours >= 24 ? 'days from assignment to first contact' : 'hours from assignment to first contact'}
            />
            <StatCard label="Resolution Rate" value={`${report.resolution_rate}%`} sub="of closed cases" />
            <StatCard label="Check-in Engagement" value={avgEngagement} sub="average weekly check-in rate" />
          </div>

          {/* Two-column charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-xl">
            {/* Left column */}
            <div className="flex flex-col gap-xl">
              {/* Flags by dimension — horizontal bar */}
              <div className="bg-surface-container-lowest rounded-card p-lg shadow-warm border border-outline-variant/20 flex flex-col gap-md">
                <div>
                  <h2 className="text-[18px] font-normal text-on-surface">Flags by dimension</h2>
                  <p className="text-[13px] text-on-surface-variant mt-1">Breakdown of wellness dimensions triggering flags this semester.</p>
                </div>
                {dimensionData.length === 0 ? (
                  <p className="text-[13px] text-on-surface-variant py-4">No flag data yet.</p>
                ) : (
                  <div className="flex flex-col gap-md mt-1">
                    {dimensionData.sort((a, b) => b.value - a.value).map((d, i) => {
                      const total = dimensionData.reduce((s, x) => s + x.value, 0);
                      const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
                      return (
                        <div key={d.name} className="flex flex-col gap-1">
                          <div className="flex justify-between text-[14px]">
                            <span className="capitalize text-on-surface">{d.name}</span>
                            <span className="text-on-surface-variant">{d.value}</span>
                          </div>
                          <div className="h-2 w-full bg-surface-variant rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Flag trend bar chart */}
              <div className="bg-surface-container-lowest rounded-card p-lg shadow-warm border border-outline-variant/20 flex flex-col gap-md">
                <h2 className="text-[18px] font-normal text-on-surface">Flags raised per week</h2>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={report.flag_trend} barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8E2D9" vertical={false} />
                    <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#B0A89E' }} tickLine={false} axisLine={false}
                      tickFormatter={w => w.slice(5)} />
                    <YAxis tick={{ fontSize: 10, fill: '#B0A89E' }} tickLine={false} axisLine={false} width={24} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" name="Flags" fill="#D4956A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Right column */}
            <div className="flex flex-col gap-xl">
              {/* Check-in engagement line chart */}
              <div className="bg-surface-container-lowest rounded-card p-lg shadow-warm border border-outline-variant/20 flex flex-col gap-md">
                <h2 className="text-[18px] font-normal text-on-surface">Check-in engagement by week</h2>
                <div className="relative h-48 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={report.weekly_engagement}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8E2D9" vertical={false} />
                      <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#B0A89E' }} tickLine={false} axisLine={false}
                        tickFormatter={w => w.slice(5)} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#B0A89E' }} tickLine={false} axisLine={false}
                        width={34} unit="%" />
                      <Tooltip content={<CustomTooltip />} />
                      <Line dataKey="rate" name="Check-in Rate" stroke="#7c9e8f" strokeWidth={2.5}
                        dot={{ r: 4, fill: '#7c9e8f' }} unit="%" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Dimension pie */}
              {dimensionData.length > 0 && (
                <div className="bg-surface-container-lowest rounded-card p-lg shadow-warm border border-outline-variant/20 flex flex-col gap-md">
                  <h2 className="text-[18px] font-normal text-on-surface">Dimension breakdown</h2>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={dimensionData}
                        cx="50%"
                        cy="50%"
                        outerRadius={75}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`}
                        labelLine={false}
                      >
                        {dimensionData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Footer note */}
          <footer className="border-t border-outline-variant/20 pt-md text-center">
            <p className="text-[12px] text-on-surface-variant">
              This report is for institutional planning only. It never contains individual student names in exported form.
            </p>
          </footer>
        </div>
      )}
    </div>
  );
};
