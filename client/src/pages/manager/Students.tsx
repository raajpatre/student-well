import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { apiCall } from '../../lib/api';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';

interface FlagRow {
  flag_id: string;
  student_id: string;
  student_name: string;
  branch: string | null;
  batch: string | null;
  semester: number | null;
  risk_level: 'high' | 'medium' | 'watch';
  triggered_dimensions: string[];
  weeks_flagged: number;
  flag_status: string;
  assignment_status: string | null;
  last_checkin_date: string | null;
}

interface StudentReport {
  student: { id: string; full_name: string; branch: string; batch: string; semester: number; roll_number: string };
  wellness_snapshot: { academic_status: string; emotional_status: string; social_status: string; academic_score: number; emotional_score: number; social_score: number; calculated_at: string } | null;
  checkin_trend: { week_start: string; academic_score?: number; emotional_score?: number; social_score?: number; sleep_score?: number }[];
  flag_history: { risk_level: string; status: string; weeks_flagged: number; created_at: string }[];
}

interface Counsellor {
  id: string;
  full_name: string;
  specialisation_tags: string[];
  personality_description: string;
  capacity_limit: number;
  current_caseload_count: number;
  is_on_leave: boolean;
}

const riskBadgeClass = (level: string) => {
  switch (level) {
    case 'high': return 'bg-error-container text-on-error-container';
    case 'medium': return 'bg-secondary-container text-on-secondary-container';
    default: return 'bg-primary-fixed text-on-primary-fixed';
  }
};

const RiskBadge = ({ level }: { level: string }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium tracking-wide ${riskBadgeClass(level)}`}>
    {level === 'high' ? 'High Risk' : level === 'medium' ? 'Medium Risk' : 'Watch'}
  </span>
);

const statusBadgeClass = (status: string | null) => {
  if (!status || status === 'unassigned') return 'bg-tertiary-fixed text-on-tertiary-fixed-variant italic';
  if (status === 'ongoing') return 'bg-primary-container text-on-primary-container';
  if (status === 'contacted') return 'bg-primary-fixed text-on-primary-fixed-variant';
  if (status === 'pending_contact') return 'bg-secondary-fixed text-on-secondary-fixed-variant';
  return 'bg-surface-container text-on-surface-variant';
};

const StatusBadge = ({ status }: { status: string | null }) => {
  const label = !status || status === 'unassigned'
    ? 'Unassigned'
    : status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${statusBadgeClass(status)}`}>
      {label}
    </span>
  );
};

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

// ─── Assignment Modal ─────────────────────────────────────────────────────────
const AssignModal: React.FC<{
  report: StudentReport;
  flagId: string;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ report, flagId, onClose, onSuccess }) => {
  const { data: cData } = useApi<Counsellor[]>('/api/manager/counsellors');
  const counsellors = cData || [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleAssign = async () => {
    if (!selectedId) { setErr('Please select a counsellor.'); return; }
    setSaving(true); setErr('');
    try {
      await apiCall('/api/manager/assignments', {
        method: 'POST',
        body: JSON.stringify({
          student_id: report.student.id,
          counsellor_id: selectedId,
          flag_id: flagId,
          manager_note: note || null,
        }),
      });
      onSuccess();
      onClose();
    } catch (e: any) {
      setErr(e.message || 'Failed to assign.');
    } finally {
      setSaving(false);
    }
  };

  const snap = report.wellness_snapshot;

  return (
    <div
      className="fixed inset-0 z-50 bg-inverse-surface/40 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface-container-lowest rounded-2xl shadow-warm-glow w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-lg py-md border-b border-custom-divider flex-shrink-0">
          <div>
            <h2 className="text-[16px] font-medium text-on-surface">Assign Counsellor</h2>
            <p className="text-[12px] text-on-surface-variant mt-0.5">{report.student.full_name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-outline hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left — student summary */}
          <div className="flex-1 overflow-y-auto p-lg border-r border-custom-divider">
            <p className="text-label-caps text-on-surface-variant uppercase tracking-wider mb-3">Student Summary</p>
            <div className="flex flex-col gap-1.5 text-[13px] mb-5">
              <div><span className="text-on-surface-variant">Roll: </span>{report.student.roll_number || '—'}</div>
              <div><span className="text-on-surface-variant">Branch: </span>{report.student.branch || '—'} · Batch {report.student.batch || '—'}</div>
              <div><span className="text-on-surface-variant">Semester: </span>{report.student.semester || '—'}</div>
            </div>

            {snap && (
              <div className="mb-5">
                <p className="text-label-caps text-on-surface-variant uppercase tracking-wider mb-3">Wellness Snapshot</p>
                {['academic', 'emotional', 'social'].map(dim => (
                  <div key={dim} className="flex items-center gap-2 py-2 border-b border-custom-divider/50 last:border-0 text-[13px]">
                    <span className="w-16 text-on-surface-variant capitalize">{dim}</span>
                    <RiskBadge level={(snap as any)[`${dim}_status`] === 'risk' ? 'high' : 'watch'} />
                    <div className="flex-1 h-1.5 rounded-full bg-outline-variant overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary-container"
                        style={{ width: `${Math.min(100, ((snap as any)[`${dim}_score`] || 0) * 10)}%` }}
                      />
                    </div>
                    <span className="text-[12px] text-on-surface-variant w-8 text-right">
                      {(snap as any)[`${dim}_score`]?.toFixed(1) ?? '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {report.checkin_trend.length > 0 && (
              <>
                <p className="text-label-caps text-on-surface-variant uppercase tracking-wider mb-3">4-Week Check-in Trend</p>
                <ResponsiveContainer width="100%" height={100}>
                  <LineChart data={report.checkin_trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8E2D9" vertical={false} />
                    <XAxis dataKey="week_start" tick={{ fontSize: 9, fill: '#B0A89E' }} tickLine={false} axisLine={false} tickFormatter={w => w.slice(5)} />
                    <YAxis domain={[0, 10]} hide />
                    <Tooltip />
                    <Line dataKey="academic_score" stroke="#456558" strokeWidth={1.5} dot={false} name="Academic" />
                    <Line dataKey="emotional_score" stroke="#D4956A" strokeWidth={1.5} dot={false} name="Emotional" />
                    <Line dataKey="social_score" stroke="#7c9e8f" strokeWidth={1.5} dot={false} name="Social" />
                  </LineChart>
                </ResponsiveContainer>
              </>
            )}

            <div className="mt-4">
              <p className="text-label-caps text-on-surface-variant uppercase tracking-wider mb-2">Manager Note</p>
              <textarea
                placeholder="Optional context for the counsellor…"
                value={note}
                onChange={e => setNote(e.target.value)}
                className="w-full min-h-[70px] bg-surface-container-low border border-outline-variant rounded-input p-3 text-on-surface text-[13px] font-sans resize-y focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* Right — counsellor list */}
          <div className="w-64 overflow-y-auto p-lg flex-shrink-0">
            <p className="text-label-caps text-on-surface-variant uppercase tracking-wider mb-3">Select Counsellor</p>
            {counsellors.length === 0
              ? <p className="text-[13px] text-on-surface-variant">No counsellors found.</p>
              : counsellors.map(c => (
                <div
                  key={c.id}
                  onClick={() => !c.is_on_leave && setSelectedId(c.id)}
                  className={`p-3 rounded-xl border mb-2 transition-colors cursor-pointer ${
                    c.is_on_leave ? 'opacity-50 cursor-not-allowed border-outline-variant' :
                    selectedId === c.id
                      ? 'border-primary bg-primary-fixed/30'
                      : 'border-outline-variant hover:bg-surface-container-low'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[13px] font-medium text-on-surface">{c.full_name}</span>
                    {c.is_on_leave && <span className="text-[10px] text-outline">On Leave</span>}
                  </div>
                  {c.personality_description && (
                    <p className="text-[12px] text-on-surface-variant mb-2 leading-relaxed line-clamp-2">{c.personality_description}</p>
                  )}
                  <div className="flex justify-between text-[11px] text-on-surface-variant mb-1">
                    <span>Caseload</span>
                    <span>{c.current_caseload_count} / {c.capacity_limit}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-outline-variant overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${c.current_caseload_count >= c.capacity_limit ? 'bg-outline' : 'bg-primary-container'}`}
                      style={{ width: `${Math.min(100, (c.current_caseload_count / c.capacity_limit) * 100)}%` }}
                    />
                  </div>
                  {c.specialisation_tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {c.specialisation_tags.map(t => (
                        <span key={t} className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[10px]">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            }
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-lg py-md border-t border-custom-divider flex-shrink-0">
          {err && <span className="text-[12px] text-on-error-container mr-auto">{err}</span>}
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-btn border border-outline-variant text-on-surface-variant text-[14px] font-medium hover:bg-surface-container transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={saving || !selectedId}
            className="px-4 py-2 rounded-btn bg-primary text-on-primary text-[14px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? 'Assigning…' : 'Confirm Assignment'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Slide-over panel ─────────────────────────────────────────────────────────
const SlideOver: React.FC<{
  flag: FlagRow;
  onClose: () => void;
  onAssign: (report: StudentReport, flagId: string) => void;
}> = ({ flag, onClose, onAssign }) => {
  const { data: report, isLoading } = useApi<StudentReport>(`/api/manager/students/${flag.student_id}/report`);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-inverse-surface/30" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-[400px] max-w-full bg-surface-container-lowest shadow-warm-glow flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-lg py-md border-b border-custom-divider flex-shrink-0">
          <div>
            <h2 className="text-[15px] font-medium text-on-surface">{flag.student_name}</h2>
            <p className="text-[12px] text-on-surface-variant mt-0.5">
              {flag.branch} · Batch {flag.batch} · Sem {flag.semester}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-outline hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-lg">
          {isLoading
            ? [1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-surface-container animate-pulse mb-3" />)
            : report && (
              <>
                {/* Flag info */}
                <div className="flex gap-2 mb-5 flex-wrap">
                  <RiskBadge level={flag.risk_level} />
                  <StatusBadge status={flag.assignment_status || flag.flag_status} />
                  <span className="text-[12px] text-on-surface-variant">Flagged {flag.weeks_flagged} week(s)</span>
                </div>

                {/* Triggered dimensions */}
                <div className="mb-5">
                  <p className="text-label-caps text-on-surface-variant uppercase tracking-wider mb-2">Triggered Dimensions</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {flag.triggered_dimensions?.map(d => (
                      <span key={d} className="px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant text-[12px]">{d}</span>
                    ))}
                  </div>
                </div>

                {/* Wellness snapshot */}
                {report.wellness_snapshot && (
                  <div className="mb-5">
                    <p className="text-label-caps text-on-surface-variant uppercase tracking-wider mb-2">Wellness Snapshot</p>
                    {['academic', 'emotional', 'social'].map(dim => {
                      const status = (report.wellness_snapshot as any)[`${dim}_status`];
                      const score = (report.wellness_snapshot as any)[`${dim}_score`];
                      return (
                        <div key={dim} className="flex items-center gap-3 py-2 border-b border-custom-divider/50 last:border-0 text-[13px]">
                          <span className="w-16 text-on-surface-variant capitalize">{dim}</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${riskBadgeClass(status === 'risk' ? 'high' : status === 'attention' ? 'medium' : 'watch')}`}>
                            {status || 'ok'}
                          </span>
                          <div className="flex-1 h-1.5 rounded-full bg-outline-variant overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary-container"
                              style={{ width: `${Math.min(100, (score || 0) * 10)}%` }}
                            />
                          </div>
                          <span className="text-[12px] text-on-surface-variant w-8 text-right">{score?.toFixed(1) ?? '—'}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Checkin trend chart */}
                {report.checkin_trend.length > 0 && (
                  <div className="mb-5">
                    <p className="text-label-caps text-on-surface-variant uppercase tracking-wider mb-2">4-Week Score Trend</p>
                    <ResponsiveContainer width="100%" height={130}>
                      <LineChart data={report.checkin_trend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E8E2D9" vertical={false} />
                        <XAxis dataKey="week_start" tick={{ fontSize: 9, fill: '#B0A89E' }} tickLine={false} axisLine={false} tickFormatter={w => w.slice(5)} />
                        <YAxis domain={[0, 10]} tick={{ fontSize: 9, fill: '#B0A89E' }} tickLine={false} axisLine={false} width={20} />
                        <Tooltip />
                        <Line dataKey="academic_score" stroke="#456558" strokeWidth={2} dot={{ r: 3 }} name="Academic" />
                        <Line dataKey="emotional_score" stroke="#D4956A" strokeWidth={2} dot={{ r: 3 }} name="Emotional" />
                        <Line dataKey="social_score" stroke="#7c9e8f" strokeWidth={2} dot={{ r: 3 }} name="Social" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Flag history */}
                {report.flag_history.length > 0 && (
                  <div>
                    <p className="text-label-caps text-on-surface-variant uppercase tracking-wider mb-2">Flag History</p>
                    {report.flag_history.map((fh, i) => (
                      <div key={i} className="flex items-center gap-2 py-2 border-b border-custom-divider/50 last:border-0 text-[12px]">
                        <RiskBadge level={fh.risk_level} />
                        <span className="text-on-surface-variant">{fh.weeks_flagged}w · {formatDate(fh.created_at)}</span>
                        <StatusBadge status={fh.status} />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )
          }
        </div>

        <div className="flex items-center justify-end gap-3 px-lg py-md border-t border-custom-divider flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-btn border border-outline-variant text-on-surface-variant text-[14px] font-medium hover:bg-surface-container transition-colors"
          >
            Close
          </button>
          {report && flag.flag_status !== 'assigned' && (
            <button
              onClick={() => onAssign(report, flag.flag_id)}
              className="px-4 py-2 rounded-btn bg-primary text-on-primary text-[14px] font-medium hover:bg-primary/90 transition-colors"
            >
              Assign Counsellor
            </button>
          )}
        </div>
      </div>
    </>
  );
};

// ─── Invite row type ──────────────────────────────────────────────────────────
interface InviteRow {
  id: string;
  email: string;
  full_name: string;
  roll_number: string;
  batch: string;
  semester: number;
  status: 'pending' | 'resent' | 'activated' | 'expired';
  invited_at: string;
  expires_at: string;
  activated_at: string | null;
  resend_count: number;
}

// ─── Invite Status Panel ──────────────────────────────────────────────────────
const InviteStatusPanel: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading, refetch } = useApi<{ invites: InviteRow[] }>('/api/manager/students/invite-status');
  const invites = data?.invites || [];

  const pending = invites.filter(i => i.status === 'pending' || i.status === 'resent');
  const activated = invites.filter(i => i.status === 'activated');
  const expired = invites.filter(i => i.status === 'expired');

  const handleResend = async (id: string) => {
    try {
      await apiCall(`/api/manager/students/resend-invite/${id}`, { method: 'POST', body: {} });
      refetch();
    } catch (err: any) {
      alert(err.message || 'Failed to resend');
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this invite? The student will no longer be able to activate their account.')) return;
    try {
      await apiCall(`/api/manager/students/revoke-invite/${id}`, { method: 'DELETE' });
      refetch();
    } catch (err: any) {
      alert(err.message || 'Failed to revoke');
    }
  };

  const statusBadge = (status: InviteRow['status']) => {
    if (status === 'activated') return <span className="px-2 py-0.5 rounded-full bg-primary-fixed/40 text-on-primary-fixed text-[11px] font-medium">Active</span>;
    if (status === 'expired') return <span className="px-2 py-0.5 rounded-full bg-surface-container text-outline text-[11px] font-medium">Expired</span>;
    if (status === 'resent') return <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[11px] font-medium">Resent</span>;
    return <span className="px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant text-[11px] font-medium">Pending</span>;
  };

  return (
    <div className="px-8 py-8 max-w-[1200px] mx-auto">
      <div className="mb-xl flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-light text-on-surface mb-1">Students · Pending Invites</h1>
          <p className="text-[13px] text-on-surface-variant">
            Total invited: {invites.length} · Activated: {activated.length} · Pending: {pending.length} · Expired: {expired.length}
          </p>
        </div>
        <button
          onClick={() => navigate('/manager/students/onboard')}
          className="flex items-center gap-2 px-4 py-2 bg-primary-container text-on-primary rounded-btn text-[14px] font-medium hover:bg-primary transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person_add</span>
          Onboard Students
        </button>
      </div>

      <div className="bg-surface-container-lowest rounded-card shadow-warm overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-on-surface-variant text-[14px]">Loading…</div>
        ) : invites.length === 0 ? (
          <div className="py-16 text-center">
            <span className="material-symbols-outlined text-outline" style={{ fontSize: '36px' }}>mail</span>
            <p className="mt-3 font-medium text-on-surface">No invites sent yet</p>
            <p className="text-[13px] text-on-surface-variant mt-1">Use the Onboard Students page to invite students.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-custom-divider bg-surface-container-low">
                  <th className="text-label-caps text-on-surface-variant py-3 px-md font-medium tracking-wider uppercase">Name</th>
                  <th className="text-label-caps text-on-surface-variant py-3 px-md font-medium tracking-wider uppercase">Roll No.</th>
                  <th className="text-label-caps text-on-surface-variant py-3 px-md font-medium tracking-wider uppercase">Email</th>
                  <th className="text-label-caps text-on-surface-variant py-3 px-md font-medium tracking-wider uppercase">Batch</th>
                  <th className="text-label-caps text-on-surface-variant py-3 px-md font-medium tracking-wider uppercase">Invited</th>
                  <th className="text-label-caps text-on-surface-variant py-3 px-md font-medium tracking-wider uppercase">Expires</th>
                  <th className="text-label-caps text-on-surface-variant py-3 px-md font-medium tracking-wider uppercase">Status</th>
                  <th className="text-label-caps text-on-surface-variant py-3 px-md font-medium tracking-wider uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="text-[14px] text-on-surface divide-y divide-custom-divider/50">
                {invites.map(invite => (
                  <tr key={invite.id} className={`h-12 ${invite.status === 'expired' ? 'opacity-50' : ''}`}>
                    <td className="px-md py-2 font-medium">{invite.full_name}</td>
                    <td className="px-md py-2 text-on-surface-variant">{invite.roll_number}</td>
                    <td className="px-md py-2 text-on-surface-variant">{invite.email}</td>
                    <td className="px-md py-2 text-on-surface-variant">{invite.batch}</td>
                    <td className="px-md py-2 text-on-surface-variant">{formatDate(invite.invited_at)}</td>
                    <td className="px-md py-2 text-on-surface-variant">
                      {invite.status === 'activated' ? formatDate(invite.activated_at) : formatDate(invite.expires_at)}
                    </td>
                    <td className="px-md py-2">{statusBadge(invite.status)}</td>
                    <td className="px-md py-2">
                      {invite.status !== 'activated' && invite.status !== 'expired' && (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleResend(invite.id)}
                            disabled={invite.resend_count >= 3}
                            className="text-[13px] text-primary-container hover:opacity-70 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                            title={invite.resend_count >= 3 ? 'Max resends reached' : 'Resend invite'}
                          >
                            Resend
                          </button>
                          <button
                            onClick={() => handleRevoke(invite.id)}
                            className="text-[13px] text-custom-terracotta hover:opacity-70 transition-opacity"
                          >
                            Revoke
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
export const StudentsPage: React.FC = () => {
  const [pageTab, setPageTab] = useState<'flags' | 'invites'>('flags');
  const [branch, setBranch] = useState('');
  const [batch, setBatch] = useState('');
  const [riskLevel, setRiskLevel] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedFlag, setSelectedFlag] = useState<FlagRow | null>(null);
  const [assignTarget, setAssignTarget] = useState<{ report: StudentReport; flagId: string } | null>(null);

  const params = new URLSearchParams();
  if (branch) params.set('branch', branch);
  if (batch) params.set('batch', batch);
  if (riskLevel) params.set('risk_level', riskLevel);
  if (statusFilter) params.set('status', statusFilter);
  const qs = params.toString();

  const { data, isLoading, refetch } = useApi<{ flags: FlagRow[] }>(
    `/api/manager/flags${qs ? '?' + qs : ''}`
  );

  const flags = data?.flags || [];

  const handleAssignSuccess = useCallback(() => {
    setSelectedFlag(null);
    refetch();
  }, [refetch]);

  if (pageTab === 'invites') {
    return (
      <>
        {/* Tab bar */}
        <div className="px-8 pt-8 max-w-[1200px] mx-auto">
          <div className="flex gap-1 mb-lg bg-surface-container-low rounded-full p-1 w-fit">
            <button onClick={() => setPageTab('flags')} className="px-5 py-2 rounded-full text-[13px] font-medium text-outline hover:text-on-surface-variant transition-colors">
              At-Risk List
            </button>
            <button onClick={() => setPageTab('invites')} className="px-5 py-2 rounded-full text-[13px] font-medium bg-surface-container-lowest text-on-surface shadow-sm transition-colors">
              Pending Invites
            </button>
          </div>
        </div>
        <InviteStatusPanel />
      </>
    );
  }

  return (
    <div className="px-8 py-8 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="mb-xl">
        <h1 className="text-[22px] font-light text-on-surface mb-1">Students · At-Risk List</h1>
        <p className="text-[13px] text-on-surface-variant">
          {flags.length} student{flags.length !== 1 ? 's' : ''} flagged · sorted by priority
        </p>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 mb-lg bg-surface-container-low rounded-full p-1 w-fit">
        <button onClick={() => setPageTab('flags')} className="px-5 py-2 rounded-full text-[13px] font-medium bg-surface-container-lowest text-on-surface shadow-sm transition-colors">
          At-Risk List
        </button>
        <button onClick={() => setPageTab('invites')} className="px-5 py-2 rounded-full text-[13px] font-medium text-outline hover:text-on-surface-variant transition-colors">
          Pending Invites
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-lg">
        <input
          placeholder="Branch"
          value={branch}
          onChange={e => setBranch(e.target.value)}
          className="px-md py-xs rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface text-[14px] font-medium focus:outline-none focus:border-primary w-28"
        />
        <input
          placeholder="Batch"
          value={batch}
          onChange={e => setBatch(e.target.value)}
          className="px-md py-xs rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface text-[14px] font-medium focus:outline-none focus:border-primary w-24"
        />
        <select
          value={riskLevel}
          onChange={e => setRiskLevel(e.target.value)}
          className="px-md py-xs rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface text-[14px] font-medium focus:outline-none focus:border-primary"
        >
          <option value="">All Risk Levels</option>
          <option value="high">High Risk</option>
          <option value="medium">Medium Risk</option>
          <option value="watch">Watch</option>
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-md py-xs rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface text-[14px] font-medium focus:outline-none focus:border-primary"
        >
          <option value="">All Statuses</option>
          <option value="unassigned">Unassigned</option>
          <option value="assigned">Assigned</option>
          <option value="pending_contact">Pending Contact</option>
          <option value="ongoing">Ongoing</option>
        </select>
        {(branch || batch || riskLevel || statusFilter) && (
          <button
            onClick={() => { setBranch(''); setBatch(''); setRiskLevel(''); setStatusFilter(''); }}
            className="px-md py-xs rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface-variant text-[14px] font-medium hover:bg-surface-container transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest rounded-card shadow-warm overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-on-surface-variant text-[14px]">Loading…</div>
        ) : flags.length === 0 ? (
          <div className="py-16 text-center">
            <span className="material-symbols-outlined text-sage-green" style={{ fontSize: '36px' }}>check_circle</span>
            <p className="mt-3 font-medium text-on-surface">No students flagged</p>
            <p className="text-[13px] text-on-surface-variant mt-1">All clear for the current filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-custom-divider bg-surface-container-low">
                  <th className="text-label-caps text-on-surface-variant py-3 px-md font-medium tracking-wider uppercase">Name</th>
                  <th className="text-label-caps text-on-surface-variant py-3 px-md font-medium tracking-wider uppercase">Branch / Batch</th>
                  <th className="text-label-caps text-on-surface-variant py-3 px-md font-medium tracking-wider uppercase">Sem</th>
                  <th className="text-label-caps text-on-surface-variant py-3 px-md font-medium tracking-wider uppercase">Risk</th>
                  <th className="text-label-caps text-on-surface-variant py-3 px-md font-medium tracking-wider uppercase">Dimensions</th>
                  <th className="text-label-caps text-on-surface-variant py-3 px-md font-medium tracking-wider uppercase">Weeks</th>
                  <th className="text-label-caps text-on-surface-variant py-3 px-md font-medium tracking-wider uppercase">Status</th>
                  <th className="text-label-caps text-on-surface-variant py-3 px-md font-medium tracking-wider uppercase">Last Check-in</th>
                </tr>
              </thead>
              <tbody className="text-[14px] text-on-surface divide-y divide-custom-divider/50">
                {flags.map(f => (
                  <tr
                    key={f.flag_id}
                    onClick={() => setSelectedFlag(f)}
                    className="h-12 hover:bg-surface-container-low transition-colors cursor-pointer"
                  >
                    <td className="px-md py-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-surface-container-high flex items-center justify-center text-[11px] font-semibold text-on-surface-variant flex-shrink-0">
                          {f.student_name.charAt(0)}
                        </div>
                        <span className="font-medium">{f.student_name}</span>
                      </div>
                    </td>
                    <td className="px-md py-2 text-on-surface-variant">{f.branch || '—'} / {f.batch || '—'}</td>
                    <td className="px-md py-2 text-on-surface-variant">{f.semester || '—'}</td>
                    <td className="px-md py-2"><RiskBadge level={f.risk_level} /></td>
                    <td className="px-md py-2">
                      <div className="flex gap-1 flex-wrap">
                        {f.triggered_dimensions?.map(d => (
                          <span key={d} className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[11px]">{d}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-md py-2 font-medium">{f.weeks_flagged}</td>
                    <td className="px-md py-2"><StatusBadge status={f.assignment_status || f.flag_status} /></td>
                    <td className="px-md py-2 text-on-surface-variant">{formatDate(f.last_checkin_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-over */}
      {selectedFlag && (
        <SlideOver
          flag={selectedFlag}
          onClose={() => setSelectedFlag(null)}
          onAssign={(report, flagId) => setAssignTarget({ report, flagId })}
        />
      )}

      {/* Assignment modal */}
      {assignTarget && (
        <AssignModal
          report={assignTarget.report}
          flagId={assignTarget.flagId}
          onClose={() => setAssignTarget(null)}
          onSuccess={handleAssignSuccess}
        />
      )}
    </div>
  );
};
