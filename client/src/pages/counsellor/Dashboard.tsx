import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, BookOpen, Brain, CheckCircle, Clock, MessageCircle, Moon, Users } from 'lucide-react';
import { useApi } from '../../hooks/useApi';

interface AssignedStudent {
  assignment_id: string;
  student_id: string;
  name: string;
  branch: string | null;
  batch: string | null;
  assignment_date: string;
  intervention_status: string;
  days_since_assigned: number;
  triggering_dimensions: string[];
}

const statusLabels: Record<string, string> = {
  pending_contact: 'Pending contact',
  contacted: 'Contacted',
  ongoing: 'Ongoing',
  resolved: 'Resolved',
  escalated: 'Escalated',
};

const dimensionIcons: Record<string, React.ElementType> = {
  academic: BookOpen,
  emotional: Brain,
  social: Users,
  sleep: Moon,
};

const StatusBadge = ({ status }: { status: string }) => (
  <span className={`status-badge-sm status-${status}`}>{statusLabels[status] || status}</span>
);

const DimensionPill = ({ dimension }: { dimension: string }) => {
  const Icon = dimensionIcons[dimension] || AlertCircle;
  return (
    <span className="counsellor-dimension-pill" title={dimension}>
      <Icon size={13} />
      <span>{dimension}</span>
    </span>
  );
};

export const CounsellorDashboard: React.FC = () => {
  const { data, isLoading, error } = useApi<{ students: AssignedStudent[] }>('/api/counsellor/students');
  const students = data?.students || [];
  const pendingCount = students.filter(s => s.intervention_status === 'pending_contact').length;

  return (
    <div className="fade-in counsellor-page">
      <div className="counsellor-page-header">
        <div>
          <h1>My Students</h1>
          <p>{students.length} assigned · {pendingCount} pending first contact</p>
        </div>
      </div>

      {error && <div className="banner banner-warning">{error}</div>}

      {isLoading ? (
        <div className="counsellor-card-list">
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 126, borderRadius: 8 }} />)}
        </div>
      ) : students.length === 0 ? (
        <div className="empty-state">
          <CheckCircle />
          <p>No active assignments right now.</p>
        </div>
      ) : (
        <div className="counsellor-card-list">
          {students.map(student => (
            <Link
              key={student.assignment_id}
              to={`/counsellor/students/${student.student_id}`}
              className={`counsellor-student-card${student.intervention_status === 'pending_contact' ? ' pending' : ''}`}
            >
              <div className="counsellor-student-card-main">
                <div>
                  <h2>{student.name}</h2>
                  <p>{student.branch || 'Branch not set'} · Batch {student.batch || '—'}</p>
                </div>
                <StatusBadge status={student.intervention_status} />
              </div>

              <div className="counsellor-student-meta">
                <span><Clock size={14} /> {student.days_since_assigned} day{student.days_since_assigned === 1 ? '' : 's'} assigned</span>
                <span><MessageCircle size={14} /> {new Date(student.assignment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
              </div>

              <div className="counsellor-dimension-row">
                {student.triggering_dimensions?.length
                  ? student.triggering_dimensions.map(d => <DimensionPill key={d} dimension={d} />)
                  : <span className="tag-chip">No dimensions listed</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
