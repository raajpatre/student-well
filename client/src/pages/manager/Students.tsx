import React, { useState, useCallback } from 'react';
import { useApi } from '../../hooks/useApi';
import { apiCall } from '../../lib/api';
import { X, CheckCircle } from 'lucide-react';
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

const RiskBadge = ({ level }: { level: string }) => (
  <span className={`risk-badge risk-${level}`}>{level.toUpperCase()}</span>
);

const StatusBadge = ({ status }: { status: string | null }) => {
  if (!status) return <span className="status-badge-sm status-unassigned">Unassigned</span>;
  return <span className={`status-badge-sm status-${status}`}>{status.replace('_', ' ')}</span>;
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
    <div className="mgr-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="mgr-modal">
        <div className="mgr-modal-header">
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Assign Counsellor</h2>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{report.student.full_name}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div className="mgr-modal-body">
          {/* Left — student summary */}
          <div className="mgr-modal-left">
            <div className="mgr-section-title" style={{ marginBottom: 10 }}>Student Summary</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, marginBottom: 16 }}>
              <div><span style={{ color: 'var(--text-3)' }}>Roll: </span>{report.student.roll_number || '—'}</div>
              <div><span style={{ color: 'var(--text-3)' }}>Branch: </span>{report.student.branch || '—'} · Batch {report.student.batch || '—'}</div>
              <div><span style={{ color: 'var(--text-3)' }}>Semester: </span>{report.student.semester || '—'}</div>
            </div>

            {snap && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                <div className="mgr-section-title">Wellness Snapshot</div>
                {['academic', 'emotional', 'social'].map(dim => (
                  <div key={dim} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <span style={{ width: 65, color: 'var(--text-3)', textTransform: 'capitalize' }}>{dim}</span>
                    <span className={`risk-badge risk-${(snap as any)[`${dim}_status`] === 'risk' ? 'high' : 'watch'}`} style={{ fontSize: 10 }}>
                      {(snap as any)[`${dim}_status`] || 'ok'}
                    </span>
                    <span style={{ color: 'var(--text-3)', fontSize: 12 }}>
                      {(snap as any)[`${dim}_score`]?.toFixed(1) ?? '—'}/10
                    </span>
                  </div>
                ))}
              </div>
            )}

            {report.checkin_trend.length > 0 && (
              <>
                <div className="mgr-section-title">4-Week Check-in Trend</div>
                <ResponsiveContainer width="100%" height={100}>
                  <LineChart data={report.checkin_trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="week_start" tick={{ fontSize: 9, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} tickFormatter={w => w.slice(5)} />
                    <YAxis domain={[0, 10]} hide />
                    <Tooltip />
                    <Line dataKey="academic_score" stroke="#7c6ff7" strokeWidth={1.5} dot={false} name="Academic" />
                    <Line dataKey="emotional_score" stroke="#f97316" strokeWidth={1.5} dot={false} name="Emotional" />
                    <Line dataKey="social_score" stroke="#22d3a0" strokeWidth={1.5} dot={false} name="Social" />
                  </LineChart>
                </ResponsiveContainer>
              </>
            )}

            <div style={{ marginTop: 16 }}>
              <div className="mgr-section-title">Manager Note</div>
              <textarea
                placeholder="Optional context for the counsellor…"
                value={note}
                onChange={e => setNote(e.target.value)}
                style={{
                  width: '100%', minHeight: 80,
                  background: 'var(--surface-raised)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', padding: '10px', color: 'var(--text)',
                  fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Right — counsellor list */}
          <div className="mgr-modal-right">
            <div className="mgr-section-title">Select Counsellor</div>
            {counsellors.length === 0
              ? <p style={{ fontSize: 13, color: 'var(--text-3)' }}>No counsellors found.</p>
              : counsellors.map(c => (
                <div
                  key={c.id}
                  className={`counsellor-pick-card${selectedId === c.id ? ' selected' : ''}${c.is_on_leave ? ' on-leave' : ''}`}
                  onClick={() => !c.is_on_leave && setSelectedId(c.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div className="counsellor-pick-name">{c.full_name}</div>
                    {c.is_on_leave && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>On Leave</span>}
                  </div>
                  {c.personality_description && (
                    <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3, lineHeight: 1.4 }}>
                      {c.personality_description}
                    </p>
                  )}
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>
                      <span>Caseload</span>
                      <span>{c.current_caseload_count} / {c.capacity_limit}</span>
                    </div>
                    <div className="counsellor-capacity-bar">
                      <div className="counsellor-capacity-fill" style={{
                        width: `${Math.min(100, (c.current_caseload_count / c.capacity_limit) * 100)}%`,
                        background: c.current_caseload_count >= c.capacity_limit ? '#f97316' : 'var(--sage)',
                      }} />
                    </div>
                  </div>
                  {c.specialisation_tags?.length > 0 && (
                    <div className="counsellor-pick-tags">
                      {c.specialisation_tags.map(t => <span key={t} className="tag-chip">{t}</span>)}
                    </div>
                  )}
                </div>
              ))
            }
          </div>
        </div>

        <div className="mgr-modal-footer">
          {err && <span style={{ fontSize: 12, color: '#f97316', marginRight: 'auto' }}>{err}</span>}
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAssign} disabled={saving || !selectedId}>
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
      <div className="mgr-overlay" onClick={onClose} />
      <div className="mgr-slideover">
        <div className="mgr-slideover-header">
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>{flag.student_name}</h2>
            <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              {flag.branch} · Batch {flag.batch} · Sem {flag.semester}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div className="mgr-slideover-body">
          {isLoading
            ? [1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 8, marginBottom: 12 }} />)
            : report && (
              <>
                {/* Flag info */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  <RiskBadge level={flag.risk_level} />
                  <StatusBadge status={flag.assignment_status || flag.flag_status} />
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Flagged {flag.weeks_flagged} week(s)</span>
                </div>

                {/* Triggered dimensions */}
                <div style={{ marginBottom: 16 }}>
                  <div className="mgr-section-title">Triggered Dimensions</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {flag.triggered_dimensions?.map(d => <span key={d} className="tag-chip">{d}</span>)}
                  </div>
                </div>

                {/* Wellness snapshot */}
                {report.wellness_snapshot && (
                  <div style={{ marginBottom: 16 }}>
                    <div className="mgr-section-title">Current Wellness Snapshot</div>
                    {['academic', 'emotional', 'social'].map(dim => {
                      const status = (report.wellness_snapshot as any)[`${dim}_status`];
                      const score = (report.wellness_snapshot as any)[`${dim}_score`];
                      return (
                        <div key={dim} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 13,
                        }}>
                          <span style={{ width: 70, color: 'var(--text-3)', textTransform: 'capitalize' }}>{dim}</span>
                          <span className={`risk-badge risk-${status === 'risk' ? 'high' : status === 'attention' ? 'medium' : 'watch'}`} style={{ fontSize: 10 }}>
                            {status || 'ok'}
                          </span>
                          <div style={{ flex: 1, background: 'var(--border)', height: 5, borderRadius: 99 }}>
                            <div style={{
                              height: '100%', borderRadius: 99,
                              width: `${Math.min(100, (score || 0) * 10)}%`,
                              background: status === 'risk' ? '#f97316' : status === 'attention' ? '#f59e0b' : '#22d3a0',
                            }} />
                          </div>
                          <span style={{ fontSize: 12, color: 'var(--text-3)', width: 30, textAlign: 'right' }}>
                            {score?.toFixed(1) ?? '—'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Checkin trend chart */}
                {report.checkin_trend.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div className="mgr-section-title">4-Week Score Trend</div>
                    <ResponsiveContainer width="100%" height={130}>
                      <LineChart data={report.checkin_trend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="week_start" tick={{ fontSize: 9, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} tickFormatter={w => w.slice(5)} />
                        <YAxis domain={[0, 10]} tick={{ fontSize: 9, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} width={20} />
                        <Tooltip />
                        <Line dataKey="academic_score" stroke="#7c6ff7" strokeWidth={2} dot={{ r: 3 }} name="Academic" />
                        <Line dataKey="emotional_score" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} name="Emotional" />
                        <Line dataKey="social_score" stroke="#22d3a0" strokeWidth={2} dot={{ r: 3 }} name="Social" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Flag history */}
                {report.flag_history.length > 0 && (
                  <div>
                    <div className="mgr-section-title">Flag History</div>
                    {report.flag_history.map((fh, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 12,
                      }}>
                        <RiskBadge level={fh.risk_level} />
                        <span style={{ color: 'var(--text-3)' }}>{fh.weeks_flagged}w · {formatDate(fh.created_at)}</span>
                        <StatusBadge status={fh.status} />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )
          }
        </div>

        <div className="mgr-slideover-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          {report && flag.flag_status !== 'assigned' && (
            <button className="btn btn-primary" onClick={() => onAssign(report, flag.flag_id)}>
              Assign Counsellor
            </button>
          )}
        </div>
      </div>
    </>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
export const StudentsPage: React.FC = () => {
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

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>At-Risk Students</h1>
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>
            {flags.length} student{flags.length !== 1 ? 's' : ''} flagged · sorted by priority
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mgr-filter-bar">
        <input placeholder="Branch" value={branch} onChange={e => setBranch(e.target.value)} style={{ width: 120 }} />
        <input placeholder="Batch" value={batch} onChange={e => setBatch(e.target.value)} style={{ width: 100 }} />
        <select value={riskLevel} onChange={e => setRiskLevel(e.target.value)}>
          <option value="">All Risk Levels</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="watch">Watch</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="unassigned">Unassigned</option>
          <option value="assigned">Assigned</option>
          <option value="pending_contact">Pending Contact</option>
          <option value="ongoing">Ongoing</option>
        </select>
        {(branch || batch || riskLevel || statusFilter) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setBranch(''); setBatch(''); setRiskLevel(''); setStatusFilter(''); }}>
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="mgr-table-wrap">
        {isLoading
          ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>Loading…</div>
          : flags.length === 0
            ? (
              <div style={{ padding: 48, textAlign: 'center' }}>
                <CheckCircle size={36} style={{ color: '#22d3a0', margin: '0 auto 12px' }} />
                <p style={{ fontWeight: 600, marginBottom: 4 }}>No students flagged</p>
                <p style={{ fontSize: 13, color: 'var(--text-3)' }}>All clear for the current filters.</p>
              </div>
            )
            : (
              <table className="mgr-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Branch / Batch</th>
                    <th>Sem</th>
                    <th>Risk</th>
                    <th>Dimensions</th>
                    <th>Weeks</th>
                    <th>Status</th>
                    <th>Last Check-in</th>
                  </tr>
                </thead>
                <tbody>
                  {flags.map(f => (
                    <tr key={f.flag_id} onClick={() => setSelectedFlag(f)}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%', background: 'var(--sage-light)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700, color: 'var(--sage)', flexShrink: 0,
                          }}>
                            {f.student_name.charAt(0)}
                          </div>
                          <span style={{ fontWeight: 500 }}>{f.student_name}</span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-3)' }}>{f.branch || '—'} / {f.batch || '—'}</td>
                      <td style={{ color: 'var(--text-3)' }}>{f.semester || '—'}</td>
                      <td><RiskBadge level={f.risk_level} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {f.triggered_dimensions?.map(d => <span key={d} className="tag-chip">{d}</span>)}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{f.weeks_flagged}</td>
                      <td><StatusBadge status={f.assignment_status || f.flag_status} /></td>
                      <td style={{ color: 'var(--text-3)' }}>{formatDate(f.last_checkin_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
        }
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
