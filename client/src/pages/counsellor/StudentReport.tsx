import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { apiCall } from '../../lib/api';
import { useApi } from '../../hooks/useApi';

interface SharedSession {
  id: string;
  started_at: string;
  shared_summary: string | null;
  escalation_level: number | null;
}

type StatusUpdate = 'contacted' | 'ongoing' | 'resolved' | 'escalated';

interface StudentReport {
  student: { id: string; full_name: string; branch: string | null; batch: string | null; semester: number | null; roll_number: string | null };
  wellness_snapshot: {
    academic_status: string | null;
    emotional_status: string | null;
    social_status: string | null;
    academic_score: number | null;
    emotional_score: number | null;
    social_score: number | null;
    calculated_at: string;
  } | null;
  checkin_trend: { week_start: string; academic_score?: number; emotional_score?: number; social_score?: number; sleep_score?: number }[];
  flag_history: { risk_level: string; status: string; weeks_flagged: number; created_at: string; triggered_dimensions?: string[] }[];
  assignment: { id: string; status: string; manager_note: string | null };
  manager_note: string | null;
}

/** Status wellness badge classes */
function snapBadgeClasses(status: string | null): string {
  if (status === 'risk') return 'bg-secondary-container/20 text-secondary';
  if (status === 'attention') return 'bg-secondary-container/20 text-secondary';
  if (status === 'good') return 'bg-primary-container/20 text-primary';
  return 'bg-surface-variant text-on-surface-variant';
}

function snapBadgeLabel(status: string | null): string {
  if (status === 'risk') return 'Struggling';
  if (status === 'attention') return 'Attention';
  if (status === 'good') return 'Stable';
  return 'No Data';
}

/** Score → dot count (out of 4 dots) */
function scoreToDots(score: number | null): number {
  if (score === null) return 0;
  return Math.round((score / 10) * 4);
}

const DotBar = ({ filled, color }: { filled: number; color: string }) => (
  <div className="flex gap-1">
    {[0, 1, 2, 3].map(i => (
      <div
        key={i}
        className={`w-1.5 h-1.5 rounded-full ${i < filled ? color : 'bg-surface-variant'}`}
      />
    ))}
  </div>
);

const statusUpdateOptions: { value: StatusUpdate; label: string }[] = [
  { value: 'contacted', label: 'Contacted' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'escalated', label: 'Escalated' },
];

export const CounsellorStudentReport: React.FC = () => {
  const { id } = useParams();
  const { data: report, isLoading, error, refetch } = useApi<StudentReport>(id ? `/api/counsellor/students/${id}/report` : null);
  const { data: sharedData } = useApi<{ sessions: SharedSession[] }>(id ? `/api/counsellor/students/${id}/shared-sessions` : null);
  const sharedSessions = sharedData?.sessions || [];
  const [status, setStatus] = useState<StatusUpdate>('contacted');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const submitStatus = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    setSuccess('');

    if (status === 'resolved' && !note.trim()) {
      setFormError('Resolution note is required before marking this resolved.');
      return;
    }

    if (!report) return;
    setSaving(true);
    try {
      await apiCall(`/api/counsellor/assignments/${report.assignment.id}/status`, {
        method: 'PATCH',
        body: { status, note },
      });
      setSuccess('Status updated.');
      setNote('');
      refetch();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update status.');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-2xl mx-auto px-container-padding fade-in pt-lg">
        <div className="h-11 rounded-card bg-surface-container animate-pulse mb-4" />
        <div className="h-64 rounded-card bg-surface-container animate-pulse" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="w-full max-w-2xl mx-auto px-container-padding fade-in pt-lg">
        <Link
          to="/counsellor/dashboard"
          className="inline-flex items-center gap-1 text-primary font-body-sm text-[14px] mb-4 hover:opacity-80 transition-opacity"
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '18px', fontVariationSettings: "'FILL' 0" }}
          >
            arrow_back
          </span>
          Back to students
        </Link>
        <div className="px-4 py-3 rounded-card bg-error-container text-on-error-container text-[14px]">
          {error || 'Report not found.'}
        </div>
      </div>
    );
  }

  const snap = report.wellness_snapshot;

  const dimensions = [
    { key: 'emotional', label: 'Emotional', icon: 'favorite', status: snap?.emotional_status ?? null, score: snap?.emotional_score ?? null, iconBg: 'bg-secondary-container/30 text-secondary' },
    { key: 'academic', label: 'Academic', icon: 'menu_book', status: snap?.academic_status ?? null, score: snap?.academic_score ?? null, iconBg: 'bg-primary-container/20 text-primary' },
    { key: 'social', label: 'Social', icon: 'groups', status: snap?.social_status ?? null, score: snap?.social_score ?? null, iconBg: 'bg-surface-variant text-on-surface-variant' },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto fade-in pb-[340px]">
      {/* Transactional header (sticky) */}
      <header className="sticky top-[65px] z-30 bg-surface/90 backdrop-blur-sm border-b border-surface-container pt-4 pb-4 px-container-padding flex items-center gap-3">
        <Link
          to="/counsellor/dashboard"
          className="text-on-surface hover:bg-surface-container-low p-2 -ml-2 rounded-full transition-colors flex items-center justify-center"
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '22px', fontVariationSettings: "'FILL' 0" }}
          >
            arrow_back
          </span>
        </Link>
        <div className="flex flex-col">
          <h1 className="text-[17px] font-medium leading-tight text-on-surface">{report.student.full_name}</h1>
          <span className="text-[12px] text-on-surface-variant leading-tight">
            {report.student.branch || 'Branch not set'} S{report.student.semester || '—'}
          </span>
        </div>
        <div className="ml-auto">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-md font-label-caps text-[10px] ${
              report.assignment.status === 'resolved'
                ? 'bg-primary-container/30 text-on-primary-container'
                : report.assignment.status === 'escalated'
                ? 'bg-error-container text-on-error-container'
                : 'bg-secondary-container text-on-secondary-container'
            }`}
          >
            {report.assignment.status.replace('_', ' ')}
          </span>
        </div>
      </header>

      <main className="px-container-padding pt-6 flex flex-col gap-xl">
        {/* Manager's note */}
        <section>
          <div className="bg-surface-container-lowest rounded-xl shadow-warm relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-tertiary-container rounded-l-xl" />
            <div className="p-md pl-5 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="material-symbols-outlined text-tertiary-container"
                  style={{ fontSize: '16px', fontVariationSettings: "'FILL' 0" }}
                >
                  info
                </span>
                <span className="font-label-caps text-[11px] text-tertiary-container uppercase tracking-wider">
                  MANAGER'S NOTE
                </span>
              </div>
              <p className="font-body-md text-[14px] italic text-on-tertiary-container leading-relaxed">
                {report.manager_note
                  ? `"${report.manager_note}"`
                  : 'No manager note was added for this assignment.'}
              </p>
            </div>
          </div>
        </section>

        {/* Wellness snapshot */}
        {snap && (
          <section className="flex flex-col gap-xs">
            <h2 className="font-body-md text-body-md text-on-surface-variant mb-2">Current Snapshot</h2>
            {dimensions.map(dim => {
              const dots = scoreToDots(dim.score);
              const dotColor =
                dim.status === 'risk'
                  ? 'bg-secondary-container'
                  : dim.status === 'good'
                  ? 'bg-primary-container'
                  : 'bg-outline-variant';

              return (
                <div
                  key={dim.key}
                  className="bg-surface-container-lowest rounded-xl shadow-warm p-md h-[56px] flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${dim.iconBg}`}>
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: '18px', fontVariationSettings: "'FILL' 1" }}
                      >
                        {dim.icon}
                      </span>
                    </div>
                    <span className="font-body-sm text-body-sm text-on-surface">{dim.label}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded-full text-[12px] font-medium ${snapBadgeClasses(dim.status)}`}>
                      {snapBadgeLabel(dim.status)}
                    </span>
                    <DotBar filled={dots} color={dotColor} />
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* 4-week trend chart */}
        <section className="flex flex-col gap-xs">
          <h2 className="font-body-md text-body-md text-on-surface-variant mb-2">4-Week Check-In Trend</h2>
          {report.checkin_trend.length > 0 ? (
            <div className="bg-surface-container-lowest rounded-xl shadow-warm p-md">
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={report.checkin_trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#c1c8c3" vertical={false} />
                  <XAxis
                    dataKey="week_start"
                    tick={{ fontSize: 11, fill: '#727974' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={w => w.slice(5)}
                  />
                  <YAxis
                    domain={[0, 10]}
                    tick={{ fontSize: 11, fill: '#727974' }}
                    tickLine={false}
                    axisLine={false}
                    width={24}
                  />
                  <Tooltip />
                  <Line dataKey="academic_score" stroke="#7c9e8f" strokeWidth={2} dot={{ r: 3 }} name="Academic" />
                  <Line dataKey="emotional_score" stroke="#D4956A" strokeWidth={2} dot={{ r: 3 }} name="Emotional" />
                  <Line dataKey="social_score" stroke="#85522d" strokeWidth={2} dot={{ r: 3 }} name="Social" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="font-body-sm text-[13px] text-outline">No check-in scores in the last four weeks.</p>
          )}
        </section>

        {/* Shared chat summaries */}
        {sharedSessions.length > 0 && (
          <section className="flex flex-col gap-xs">
            <h2 className="font-body-md text-body-md text-on-surface-variant mb-2">
              Shared by Student ({sharedSessions.length})
            </h2>
            <div className="flex flex-col gap-3">
              {sharedSessions.map(session => (
                <div key={session.id} className="bg-surface-container-lowest rounded-xl shadow-warm p-md flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-body-sm text-[12px] text-on-surface-variant">
                      {new Date(session.started_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                    {session.escalation_level && session.escalation_level >= 2 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-error-container text-on-error-container">
                        Sensitive
                      </span>
                    )}
                  </div>
                  <p className="font-body-md text-[13px] text-on-surface leading-relaxed">
                    {session.shared_summary || 'No summary available.'}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Flag history */}
        <section className="flex flex-col gap-xs">
          <button className="w-full bg-surface-container-lowest rounded-xl p-md flex items-center justify-between border border-surface-container text-left shadow-warm-sm">
            <div className="flex items-center gap-3">
              <span
                className="material-symbols-outlined text-on-surface-variant"
                style={{ fontSize: '20px', fontVariationSettings: "'FILL' 0" }}
              >
                history
              </span>
              <span className="font-body-sm text-body-sm text-on-surface">
                {report.flag_history.length} previous flag{report.flag_history.length !== 1 ? 's' : ''}
              </span>
            </div>
            <span
              className="material-symbols-outlined text-on-surface-variant"
              style={{ fontSize: '20px', fontVariationSettings: "'FILL' 0" }}
            >
              expand_more
            </span>
          </button>

          {report.flag_history.length > 0 && (
            <div className="flex flex-col gap-2 mt-1">
              {report.flag_history.map((flag, index) => (
                <div
                  key={`${flag.created_at}-${index}`}
                  className="bg-surface-container-lowest rounded-xl px-md py-3 flex items-center gap-3 shadow-warm-sm"
                >
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md font-label-caps text-[10px] ${
                      flag.risk_level === 'high'
                        ? 'bg-error-container text-on-error-container'
                        : flag.risk_level === 'medium'
                        ? 'bg-secondary-container text-on-secondary-container'
                        : 'bg-primary-container/30 text-on-primary-container'
                    }`}
                  >
                    {flag.risk_level}
                  </span>
                  <span className="font-body-sm text-[12px] text-on-surface-variant">
                    {flag.weeks_flagged} week{flag.weeks_flagged === 1 ? '' : 's'}
                  </span>
                  <span className="font-body-sm text-[12px] text-outline ml-auto">
                    {new Date(flag.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Sticky bottom card: Update Status */}
      <div className="fixed bottom-0 left-0 w-full bg-surface-container-lowest rounded-t-[24px] shadow-warm-glow px-container-padding py-lg flex flex-col gap-4 z-50 border-t border-surface-container/50">
        <h3 className="font-body-sm text-[14px] font-medium text-on-surface">Update status</h3>

        {/* Status pills (replaces select) */}
        <form onSubmit={submitStatus} className="flex flex-col gap-4">
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {statusUpdateOptions.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatus(opt.value)}
                className={`whitespace-nowrap px-4 py-2 rounded-full font-body-sm text-[13px] transition-colors ${
                  status === opt.value
                    ? 'bg-primary-container text-on-primary-container'
                    : 'border border-surface-container text-on-surface-variant bg-surface'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Note textarea */}
          <div className="relative">
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={status === 'resolved' ? 'Resolution note required' : 'Brief note (visible only to manager)'}
              rows={3}
              className="w-full bg-surface rounded-input border border-surface-container p-4 font-body-md text-[14px] text-on-surface placeholder:text-outline-variant resize-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
            />
          </div>

          {formError && (
            <div className="px-4 py-3 rounded-card bg-error-container text-on-error-container text-[13px]">
              {formError}
            </div>
          )}
          {success && (
            <div className="px-4 py-3 rounded-card bg-primary-container/20 text-on-primary-container text-[13px] flex items-center gap-2">
              <span
                className="material-symbols-outlined"
                style={{ fontSize: '16px', fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-primary text-on-primary py-4 rounded-btn font-body-sm text-body-sm flex justify-center items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '18px', fontVariationSettings: "'FILL' 0" }}
            >
              send
            </span>
            {saving ? 'Saving…' : 'Save Update'}
          </button>
        </form>
      </div>
    </div>
  );
};
