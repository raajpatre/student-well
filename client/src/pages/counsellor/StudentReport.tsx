import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Brain, CheckCircle, MessageSquareWarning, Send, Users } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { apiCall } from '../../lib/api';
import { useApi } from '../../hooks/useApi';

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

const DimensionSnapshot = ({ label, status, score, icon: Icon }: {
  label: string;
  status: string | null;
  score: number | null;
  icon: React.ElementType;
}) => (
  <div className="counsellor-snapshot-row">
    <Icon size={16} />
    <span>{label}</span>
    <span className={`risk-badge risk-${status === 'risk' ? 'high' : status === 'attention' ? 'medium' : 'watch'}`}>
      {status || 'good'}
    </span>
    <strong>{score?.toFixed(1) ?? '—'}</strong>
  </div>
);

export const CounsellorStudentReport: React.FC = () => {
  const { id } = useParams();
  const { data: report, isLoading, error, refetch } = useApi<StudentReport>(id ? `/api/counsellor/students/${id}/report` : null);
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
      <div className="fade-in counsellor-page">
        <div className="skeleton" style={{ height: 44, borderRadius: 8, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 260, borderRadius: 8 }} />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="fade-in counsellor-page">
        <Link to="/counsellor/dashboard" className="counsellor-back-link"><ArrowLeft size={16} /> Back</Link>
        <div className="banner banner-warning">{error || 'Report not found.'}</div>
      </div>
    );
  }

  const snap = report.wellness_snapshot;

  return (
    <div className="fade-in counsellor-page counsellor-report-page">
      <Link to="/counsellor/dashboard" className="counsellor-back-link"><ArrowLeft size={16} /> Back to students</Link>

      <div className="counsellor-manager-note">
        <div>
          <span>Manager note</span>
          <p>{report.manager_note || 'No manager note was added for this assignment.'}</p>
        </div>
        <MessageSquareWarning size={20} />
      </div>

      <div className="counsellor-report-header">
        <div>
          <h1>{report.student.full_name}</h1>
          <p>{report.student.branch || 'Branch not set'} · Batch {report.student.batch || '—'} · Sem {report.student.semester || '—'}</p>
        </div>
        <span className={`status-badge-sm status-${report.assignment.status}`}>{report.assignment.status.replace('_', ' ')}</span>
      </div>

      {snap && (
        <section className="counsellor-report-section">
          <div className="mgr-section-title">Wellness Snapshot</div>
          <div className="counsellor-snapshot-grid">
            <DimensionSnapshot label="Academic" status={snap.academic_status} score={snap.academic_score} icon={BookOpen} />
            <DimensionSnapshot label="Emotional" status={snap.emotional_status} score={snap.emotional_score} icon={Brain} />
            <DimensionSnapshot label="Social" status={snap.social_status} score={snap.social_score} icon={Users} />
          </div>
        </section>
      )}

      <section className="counsellor-report-section">
        <div className="mgr-section-title">4-Week Check-In Trend</div>
        {report.checkin_trend.length > 0 ? (
          <div className="counsellor-chart-box">
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={report.checkin_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="week_start" tick={{ fontSize: 11, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} tickFormatter={w => w.slice(5)} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} width={24} />
                <Tooltip />
                <Line dataKey="academic_score" stroke="#7c6ff7" strokeWidth={2} dot={{ r: 3 }} name="Academic" />
                <Line dataKey="emotional_score" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} name="Emotional" />
                <Line dataKey="social_score" stroke="#22d3a0" strokeWidth={2} dot={{ r: 3 }} name="Social" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="counsellor-muted">No check-in scores in the last four weeks.</p>
        )}
      </section>

      <section className="counsellor-report-section">
        <div className="mgr-section-title">Flag History</div>
        {report.flag_history.length > 0 ? report.flag_history.map((flag, index) => (
          <div key={`${flag.created_at}-${index}`} className="counsellor-flag-row">
            <span className={`risk-badge risk-${flag.risk_level === 'high' ? 'high' : flag.risk_level === 'medium' ? 'medium' : 'watch'}`}>
              {flag.risk_level}
            </span>
            <span>{flag.weeks_flagged} week{flag.weeks_flagged === 1 ? '' : 's'}</span>
            <span>{new Date(flag.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            <span className={`status-badge-sm status-${flag.status}`}>{flag.status}</span>
          </div>
        )) : <p className="counsellor-muted">No flags found.</p>}
      </section>

      <form className="counsellor-status-form" onSubmit={submitStatus}>
        <div>
          <h2>Update Status</h2>
          <p>Keep this brief. The human follow-up is the important part.</p>
        </div>
        <select value={status} onChange={e => setStatus(e.target.value as StatusUpdate)}>
          <option value="contacted">Contacted</option>
          <option value="ongoing">Ongoing</option>
          <option value="resolved">Resolved</option>
          <option value="escalated">Escalated</option>
        </select>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder={status === 'resolved' ? 'Resolution note required' : 'Optional note'}
          rows={4}
        />
        {formError && <div className="banner banner-warning">{formError}</div>}
        {success && <div className="banner banner-info"><CheckCircle size={16} /> {success}</div>}
        <button className="btn btn-primary" disabled={saving}>
          <Send size={16} />
          {saving ? 'Saving...' : 'Submit'}
        </button>
      </form>
    </div>
  );
};
