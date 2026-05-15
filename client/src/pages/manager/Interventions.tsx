import React, { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { apiCall } from '../../lib/api';

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

const statusBadgeClass = (status: string, isOverdue: boolean): string => {
  if (isOverdue) return 'bg-tertiary-fixed text-on-tertiary-fixed-variant';
  if (status === 'ongoing') return 'bg-primary-container text-on-primary-container';
  if (status === 'contacted') return 'bg-primary-fixed text-on-primary-fixed-variant';
  if (status === 'pending_contact') return 'bg-secondary-fixed text-on-secondary-fixed-variant';
  return 'bg-surface-container text-on-surface-variant';
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
      <div className="fixed inset-0 z-40 bg-inverse-surface/30" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-[380px] max-w-full bg-surface-container-lowest shadow-warm-glow flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-lg py-md border-b border-custom-divider flex-shrink-0">
          <div>
            <h2 className="text-[15px] font-medium text-on-surface">{intervention.student_name}</h2>
            <p className="text-[12px] text-on-surface-variant mt-0.5">Assigned to {intervention.counsellor_name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-outline hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-lg flex flex-col gap-4">
          {intervention.is_overdue && (
            <div className="bg-tertiary-fixed/40 border border-tertiary-fixed-dim/50 rounded-xl px-md py-3 flex items-start gap-2.5">
              <span className="material-symbols-outlined text-tertiary flex-shrink-0" style={{ fontSize: '18px' }}>warning</span>
              <p className="text-[13px] text-on-tertiary-fixed-variant">
                No first contact in {intervention.days_since_assignment} days — overdue by {intervention.days_since_assignment - 5} day(s).
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Assigned', value: formatDate(intervention.assigned_at) },
              { label: 'First Contact', value: formatDate(intervention.first_contact_at) },
              { label: 'Days Since Assign.', value: `${intervention.days_since_assignment}d` },
              { label: 'Branch', value: intervention.student_branch || '—' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-surface-container-low rounded-xl px-3 py-2.5">
                <div className="text-[11px] text-on-surface-variant uppercase tracking-wider mb-1">{label}</div>
                <div className="text-[14px] font-medium text-on-surface">{value}</div>
              </div>
            ))}
          </div>

          {intervention.manager_note && (
            <div>
              <p className="text-label-caps text-on-surface-variant uppercase tracking-wider mb-2">Manager Note</p>
              <p className="text-[13px] text-on-surface leading-relaxed bg-surface-container-low px-3 py-2.5 rounded-xl">
                {intervention.manager_note}
              </p>
            </div>
          )}

          <div>
            <p className="text-label-caps text-on-surface-variant uppercase tracking-wider mb-2">Update Status</p>
            <select
              value={newStatus}
              onChange={e => setNewStatus(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant rounded-input px-3 py-2.5 text-on-surface text-[13px] font-sans focus:outline-none focus:border-primary transition-colors"
            >
              <option value="pending_contact">Pending Contact</option>
              <option value="contacted">Contacted</option>
              <option value="ongoing">Ongoing</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-lg py-md border-t border-custom-divider flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-btn border border-outline-variant text-on-surface-variant text-[14px] font-medium hover:bg-surface-container transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleStatusUpdate}
            disabled={saving || newStatus === intervention.status}
            className="px-4 py-2 rounded-btn bg-primary text-on-primary text-[14px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
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
    <div className="px-8 py-8 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="mb-xl">
        <h1 className="text-[22px] font-light text-on-surface mb-1">Interventions</h1>
        <p className="text-[13px] text-on-surface-variant flex items-center gap-2">
          {interventions.length} open case{interventions.length !== 1 ? 's' : ''}
          {overdueCount > 0 && (
            <span className="inline-flex items-center gap-1 bg-tertiary text-on-tertiary text-[10px] font-bold px-2 py-0.5 rounded-full">
              {overdueCount} overdue
            </span>
          )}
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-lg">
        {['All', 'Active', 'Overdue', 'Resolved'].map(label => (
          <button
            key={label}
            className={`px-4 py-2 rounded-full border text-[14px] font-medium transition-colors ${
              label === 'Active'
                ? 'border-primary bg-primary-fixed text-on-primary-fixed-variant hover:bg-primary-fixed-dim'
                : 'border-custom-divider bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low'
            }`}
          >
            {label}
            {label === 'Overdue' && overdueCount > 0 && (
              <span className="ml-1.5 bg-tertiary text-on-tertiary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {overdueCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Overdue banner */}
      {overdueCount > 0 && (
        <div className="bg-surface-container-low rounded-xl p-4 flex items-center gap-3 border border-custom-divider mb-lg">
          <div className="w-8 h-8 rounded-full bg-tertiary-fixed flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-tertiary" style={{ fontSize: '18px' }}>warning</span>
          </div>
          <p className="text-[13px] text-on-surface-variant">
            <strong className="text-on-surface">{overdueCount} case{overdueCount !== 1 ? 's' : ''}</strong>
            {' '}overdue — first contact not made within 5 days of assignment.
          </p>
        </div>
      )}

      {/* Table card */}
      <div className="bg-surface-container-lowest rounded-card shadow-warm overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-on-surface-variant text-[14px]">Loading…</div>
        ) : interventions.length === 0 ? (
          <div className="py-16 text-center">
            <span className="material-symbols-outlined text-sage-green" style={{ fontSize: '36px' }}>check_circle</span>
            <p className="mt-3 font-medium text-on-surface">No active interventions</p>
            <p className="text-[13px] text-on-surface-variant mt-1">All cases are resolved or not yet assigned.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-surface border-b border-custom-divider">
                    <th className="px-md py-3 text-label-caps text-outline uppercase tracking-wider font-medium">Student</th>
                    <th className="px-md py-3 text-label-caps text-outline uppercase tracking-wider font-medium">Counsellor</th>
                    <th className="px-md py-3 text-label-caps text-outline uppercase tracking-wider font-medium">Assigned</th>
                    <th className="px-md py-3 text-label-caps text-outline uppercase tracking-wider font-medium">Status</th>
                    <th className="px-md py-3 text-label-caps text-outline uppercase tracking-wider font-medium">Last Update</th>
                    <th className="px-md py-3 text-label-caps text-outline uppercase tracking-wider font-medium">Days</th>
                    <th className="px-md py-3 text-label-caps text-outline uppercase tracking-wider font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="text-[14px] text-on-surface-variant">
                  {interventions.map(i => (
                    <tr
                      key={i.assignment_id}
                      onClick={() => setSelected(i)}
                      className={`border-b border-custom-divider transition-colors cursor-pointer ${i.is_overdue ? 'bg-terracotta-light/40 hover:bg-terracotta-light/60' : 'bg-surface-container-lowest hover:bg-surface-container-low'}`}
                    >
                      <td className="px-md py-3 font-medium text-on-surface">{i.student_name}</td>
                      <td className="px-md py-3">{i.counsellor_name}</td>
                      <td className="px-md py-3 text-outline">{formatDate(i.assigned_at)}</td>
                      <td className="px-md py-3">
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[12px] font-medium ${statusBadgeClass(i.status, i.is_overdue)}`}>
                          {i.is_overdue ? 'Overdue' : (statusLabels[i.status] || i.status)}
                        </span>
                      </td>
                      <td className="px-md py-3 text-outline">
                        {i.first_contact_at
                          ? <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-sage-green" style={{ fontSize: '14px' }}>check_circle</span>{formatDate(i.first_contact_at)}</span>
                          : <span className="flex items-center gap-1.5"><span className="material-symbols-outlined" style={{ fontSize: '14px', color: i.is_overdue ? '#7d5451' : '#727974' }}>schedule</span>Pending</span>
                        }
                      </td>
                      <td className={`px-md py-3 font-medium ${i.is_overdue ? 'text-tertiary' : 'text-on-surface-variant'}`}>
                        {i.days_since_assignment}
                      </td>
                      <td className="px-md py-3 text-right">
                        <button className={`flex items-center justify-end gap-1 text-[13px] font-medium hover:underline transition-colors ${i.is_overdue ? 'text-tertiary' : 'text-primary'}`}>
                          {i.is_overdue ? 'View urgently' : 'Follow up'}
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>chevron_right</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table footer */}
            <div className="px-md py-4 bg-surface border-t border-custom-divider flex justify-between items-center text-[13px] text-outline">
              <span>Showing {interventions.length} active intervention{interventions.length !== 1 ? 's' : ''}</span>
              <div className="flex gap-2">
                <button className="p-1 rounded hover:bg-surface-container-low transition-colors opacity-40 cursor-not-allowed" disabled>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chevron_left</span>
                </button>
                <button className="p-1 rounded hover:bg-surface-container-low transition-colors">
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chevron_right</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Insights bar */}
      <div className="mt-4 bg-surface-container-low rounded-xl p-4 flex items-center gap-3 border border-custom-divider">
        <div className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: '18px' }}>insights</span>
        </div>
        <p className="text-[13px] text-primary font-medium tracking-wide">
          Track intervention progress — click any row to view details and update status.
        </p>
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
