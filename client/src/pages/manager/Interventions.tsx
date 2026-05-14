import React, { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { apiCall } from '../../lib/api';
import { AlertTriangle, Clock, CheckCircle, X } from 'lucide-react';

interface Intervention {
  assignment_id: string;
  student_name: string;
  student_branch: string | null;
  counsellor_name: string;
  status: string;
  assigned_at: string;
  first_contact_at: string | null;
  days_since_assignment: number;
  is_overdue: boolean;
  manager_note: string | null;
}

const statusLabels: Record<string, string> = {
  pending_contact: 'Pending Contact',
  contacted: 'Contacted',
  ongoing: 'Ongoing',
};

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
}

interface DetailPanelProps {
  intervention: Intervention;
  onClose: () => void;
  onUpdate: () => void;
}

const DetailPanel: React.FC<DetailPanelProps> = ({ intervention, onClose, onUpdate }) => {
  const [newStatus, setNewStatus] = useState(intervention.status);
  const [saving, setSaving] = useState(false);

  const handleStatusUpdate = async () => {
    setSaving(true);
    try {
      await apiCall(`/api/manager/assignments/${intervention.assignment_id}/reassign`, {
        method: 'PATCH',
        body: JSON.stringify({ new_counsellor_id: null, reason: `Status manually updated to ${newStatus}` }),
      });
      onUpdate();
      onClose();
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  return (
    <>
      <div className="mgr-overlay" onClick={onClose} />
      <div className="mgr-slideover">
        <div className="mgr-slideover-header">
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>{intervention.student_name}</h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Assigned to {intervention.counsellor_name}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        <div className="mgr-slideover-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {intervention.is_overdue && (
            <div style={{
              background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 'var(--radius-md)', padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertTriangle size={15} style={{ color: '#f59e0b', flexShrink: 0 }} />
              <p style={{ fontSize: 13, color: '#f59e0b' }}>
                No first contact made in {intervention.days_since_assignment} days — overdue by {intervention.days_since_assignment - 5} day(s).
              </p>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'Assigned', value: formatDate(intervention.assigned_at) },
              { label: 'First Contact', value: formatDate(intervention.first_contact_at) },
              { label: 'Days Since Assign.', value: `${intervention.days_since_assignment}d` },
              { label: 'Branch', value: intervention.student_branch || '—' },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'var(--surface-raised)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{value}</div>
              </div>
            ))}
          </div>

          {intervention.manager_note && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Manager Note</div>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5, background: 'var(--surface-raised)', padding: '10px 12px', borderRadius: 'var(--radius-md)' }}>
                {intervention.manager_note}
              </p>
            </div>
          )}

          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Update Status</div>
            <select
              value={newStatus}
              onChange={e => setNewStatus(e.target.value)}
              style={{
                width: '100%', background: 'var(--surface-raised)', border: '1px solid var(--border)',
                color: 'var(--text)', borderRadius: 'var(--radius-md)', padding: '9px 12px',
                fontSize: 13, fontFamily: 'inherit', marginBottom: 10,
              }}
            >
              <option value="pending_contact">Pending Contact</option>
              <option value="contacted">Contacted</option>
              <option value="ongoing">Ongoing</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>

        <div className="mgr-slideover-footer">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={handleStatusUpdate} disabled={saving || newStatus === intervention.status}>
            {saving ? 'Saving…' : 'Update Status'}
          </button>
        </div>
      </div>
    </>
  );
};

export const InterventionsPage: React.FC = () => {
  const { data, isLoading, refetch } = useApi<{ interventions: Intervention[] }>('/api/manager/interventions');
  const [selected, setSelected] = useState<Intervention | null>(null);

  const interventions = data?.interventions || [];
  const overdueCount = interventions.filter(i => i.is_overdue).length;

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Active Interventions</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            {interventions.length} open case{interventions.length !== 1 ? 's' : ''}
            {overdueCount > 0 && (
              <span style={{ marginLeft: 10 }} className="overdue-badge">
                <AlertTriangle size={11} /> {overdueCount} overdue
              </span>
            )}
          </p>
        </div>
      </div>

      {overdueCount > 0 && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: 'var(--radius-md)', padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
        }}>
          <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <p style={{ fontSize: 13 }}>
            <strong style={{ color: '#f59e0b' }}>{overdueCount} case{overdueCount !== 1 ? 's' : ''}</strong>
            {' '}overdue — first contact not made within 5 days of assignment.
          </p>
        </div>
      )}

      <div className="mgr-table-wrap">
        {isLoading
          ? <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
          : interventions.length === 0
            ? (
              <div style={{ padding: 48, textAlign: 'center' }}>
                <CheckCircle size={36} style={{ color: '#22d3a0', margin: '0 auto 12px' }} />
                <p style={{ fontWeight: 600, marginBottom: 4 }}>No active interventions</p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>All cases are resolved or not yet assigned.</p>
              </div>
            )
            : (
              <table className="mgr-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Counsellor</th>
                    <th>Status</th>
                    <th>Assigned</th>
                    <th>First Contact</th>
                    <th>Days</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {interventions.map(i => (
                    <tr
                      key={i.assignment_id}
                      className={i.is_overdue ? 'overdue' : ''}
                      onClick={() => setSelected(i)}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%', background: 'var(--surface-raised)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700, flexShrink: 0,
                          }}>{i.student_name.charAt(0)}</div>
                          <div>
                            <div style={{ fontWeight: 500 }}>{i.student_name}</div>
                            {i.student_branch && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{i.student_branch}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-dim)' }}>{i.counsellor_name}</td>
                      <td>
                        <span className={`status-badge-sm status-${i.status}`}>
                          {statusLabels[i.status] || i.status}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{formatDate(i.assigned_at)}</td>
                      <td style={{ color: 'var(--text-muted)' }}>
                        {i.first_contact_at
                          ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={12} style={{ color: '#22d3a0' }} />{formatDate(i.first_contact_at)}</span>
                          : <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} style={{ color: i.is_overdue ? '#f59e0b' : 'var(--text-muted)' }} />Pending</span>
                        }
                      </td>
                      <td>
                        {i.is_overdue
                          ? <span className="overdue-badge"><AlertTriangle size={10} />{i.days_since_assignment}d</span>
                          : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{i.days_since_assignment}d</span>
                        }
                      </td>
                      <td style={{ color: 'var(--accent)', fontSize: 12 }}>View →</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
        }
      </div>

      {selected && (
        <DetailPanel
          intervention={selected}
          onClose={() => setSelected(null)}
          onUpdate={refetch}
        />
      )}
    </div>
  );
};
