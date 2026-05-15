import React from 'react';
import { Link } from 'react-router-dom';
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
  pending_contact: 'Pending Contact',
  contacted: 'Contacted',
  ongoing: 'Ongoing',
  resolved: 'Resolved',
  escalated: 'Escalated',
};

const dimensionIconMap: Record<string, string> = {
  academic: 'menu_book',
  emotional: 'favorite',
  social: 'group',
  sleep: 'bedtime',
};

const filterOptions = [
  { key: 'all', label: 'All' },
  { key: 'pending_contact', label: 'Pending Contact' },
  { key: 'ongoing', label: 'Ongoing' },
  { key: 'resolved', label: 'Resolved' },
];

/** Left border color based on risk / status */
function borderColor(status: string): string {
  if (status === 'escalated') return 'bg-on-error-container';
  if (status === 'pending_contact' || status === 'ongoing') return 'bg-secondary';
  if (status === 'resolved') return 'bg-primary-container';
  return 'bg-outline';
}

/** Status badge styling */
function badgeClasses(status: string): string {
  if (status === 'pending_contact' || status === 'ongoing')
    return 'bg-secondary-container text-on-secondary-container';
  if (status === 'resolved')
    return 'bg-primary-container/30 text-on-primary-container';
  if (status === 'escalated')
    return 'bg-error-container text-on-error-container';
  return 'bg-surface-container text-on-surface-variant';
}

export const CounsellorDashboard: React.FC = () => {
  const { data, isLoading, error } = useApi<{ students: AssignedStudent[] }>('/api/counsellor/students');
  const students = data?.students || [];
  const pendingCount = students.filter(s => s.intervention_status === 'pending_contact').length;

  const [activeFilter, setActiveFilter] = React.useState('all');

  const filteredStudents =
    activeFilter === 'all' ? students : students.filter(s => s.intervention_status === activeFilter);

  return (
    <div className="w-full max-w-2xl mx-auto px-container-padding fade-in">
      {/* Page greeting / summary */}
      <div className="pt-lg pb-2">
        <h1 className="font-display text-[28px] font-light text-on-surface leading-tight">My Students</h1>
        <p className="font-label-caps text-[12px] text-secondary mt-1">
          {students.length} assigned · {pendingCount} pending first contact
        </p>
      </div>

      {/* Filter pills */}
      <div className="flex overflow-x-auto gap-2 py-4 -mx-container-padding px-container-padding snap-x snap-mandatory no-scrollbar">
        {filterOptions.map(opt => (
          <button
            key={opt.key}
            onClick={() => setActiveFilter(opt.key)}
            className={`snap-start flex-none px-4 py-1.5 rounded-full font-body-sm text-[14px] transition-colors ${
              activeFilter === opt.key
                ? 'bg-secondary text-white border border-transparent shadow-warm-sm'
                : 'bg-surface-container-lowest border border-surface-variant text-on-surface-variant shadow-[0_4px_12px_rgba(44,36,23,0.02)]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-card bg-error-container text-on-error-container text-[14px]">
          {error}
        </div>
      )}

      {/* Loading skeletons */}
      {isLoading ? (
        <div className="flex flex-col gap-4 mt-2">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="h-[140px] rounded-card bg-surface-container animate-pulse"
            />
          ))}
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-outline gap-3">
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '48px', fontVariationSettings: "'FILL' 0" }}
          >
            check_circle
          </span>
          <p className="font-body-md text-[16px]">No active assignments right now.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 mt-2 pb-6">
          {filteredStudents.map(student => (
            <Link
              key={student.assignment_id}
              to={`/counsellor/students/${student.student_id}`}
              className="bg-surface-container-lowest rounded-card shadow-warm relative overflow-hidden flex flex-col p-4 pl-5 active:scale-[0.99] transition-transform"
            >
              {/* Colored left border stripe */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-card ${borderColor(student.intervention_status)}`} />

              {/* Name + badge */}
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-body-md text-[15px] font-medium text-on-surface">{student.name}</h3>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md font-label-caps text-[10px] ${badgeClasses(student.intervention_status)}`}
                >
                  {statusLabels[student.intervention_status] || student.intervention_status}
                </span>
              </div>

              {/* Branch / batch meta */}
              <div className="mb-3">
                <p className="font-body-sm text-[12px] text-outline">
                  {student.branch || 'Branch not set'} · Batch {student.batch || '—'} · Assigned {student.days_since_assigned} day{student.days_since_assigned === 1 ? '' : 's'} ago
                </p>
              </div>

              {/* Dimension icons */}
              <div className="flex items-center gap-2 mb-4">
                {student.triggering_dimensions?.length ? (
                  student.triggering_dimensions.map(d => {
                    const icon = dimensionIconMap[d] || 'info';
                    return (
                      <div
                        key={d}
                        className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container"
                        title={d}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: '16px', fontVariationSettings: "'FILL' 1" }}
                        >
                          {icon}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="w-8 h-8 rounded-full bg-surface-variant flex items-center justify-center text-outline">
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: '16px', fontVariationSettings: "'FILL' 0" }}
                    >
                      info
                    </span>
                  </div>
                )}
              </div>

              {/* Footer row */}
              {student.intervention_status === 'pending_contact' && (
                <div className="flex items-center text-secondary gap-1 mb-3">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: '14px', fontVariationSettings: "'FILL' 0" }}
                  >
                    schedule
                  </span>
                  <span className="font-body-sm text-[12px]">
                    Day {student.days_since_assigned} — reach out soon
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-surface-variant/50">
                <span className="font-body-sm text-[12px] text-primary">
                  {new Date(student.assignment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </span>
                <span className="font-body-sm text-[14px] text-primary hover:opacity-80 transition-opacity flex items-center gap-1">
                  View report{' '}
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: '16px', fontVariationSettings: "'FILL' 0" }}
                  >
                    arrow_forward
                  </span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
