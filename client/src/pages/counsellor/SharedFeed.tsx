import React, { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { apiCall } from '../../lib/api';

interface FeedItem {
  session_id: string;
  student_id: string;
  student_name: string;
  branch: string | null;
  batch: string | null;
  shared_at: string;
  summary: string | null;
  escalation_level: number | null;
  already_assigned: boolean;
}

const SelfAssignModal: React.FC<{
  item: FeedItem;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ item, onClose, onSuccess }) => {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 10) { setErr('Please provide a reason (at least 10 characters).'); return; }
    setSaving(true); setErr('');
    try {
      await apiCall('/api/counsellor/self-assign', {
        method: 'POST',
        body: { student_id: item.student_id, session_id: item.session_id, reason: reason.trim() },
      });
      onSuccess();
      onClose();
    } catch (e: any) {
      setErr(e.message || 'Failed to self-assign.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-inverse-surface/40 flex items-end justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface-container-lowest rounded-2xl shadow-warm-glow w-full max-w-lg p-lg flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[16px] font-medium text-on-surface">Self-assign to {item.student_name}</h2>
            <p className="text-[12px] text-on-surface-variant mt-0.5">You'll be notified in My Students. The manager will see this assignment.</p>
          </div>
          <button onClick={onClose} className="p-1 text-outline hover:text-on-surface">
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="block text-[12px] text-on-surface-variant mb-1">Why are you self-assigning? <span className="text-on-error-container">*</span></label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Student shared a session showing signs of academic stress and I'd like to proactively reach out."
              rows={3}
              className="w-full bg-surface border border-outline-variant rounded-input p-3 text-[13px] text-on-surface placeholder:text-outline resize-none focus:outline-none focus:border-primary transition-colors"
            />
            <p className="text-[11px] text-outline mt-1">{reason.trim().length}/500 · min 10 characters</p>
          </div>

          {err && <p className="text-[12px] text-on-error-container">{err}</p>}

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} disabled={saving}
              className="px-4 py-2 rounded-btn border border-outline-variant text-on-surface-variant text-[14px] font-medium hover:bg-surface-container transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 rounded-btn bg-primary text-on-primary text-[14px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              {saving ? 'Assigning…' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const SharedFeedPage: React.FC = () => {
  const { data, isLoading, refetch } = useApi<{ feed: FeedItem[] }>('/api/counsellor/shared-feed');
  const [assigning, setAssigning] = useState<FeedItem | null>(null);
  const feed = data?.feed || [];

  return (
    <div className="w-full max-w-2xl mx-auto px-container-padding pt-6 pb-10 fade-in">
      <div className="mb-6">
        <h1 className="text-[20px] font-light text-on-surface mb-1">Shared Chats</h1>
        <p className="text-[13px] text-on-surface-variant">Students who shared their AI counsellor conversations. You can self-assign to reach out.</p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-36 rounded-2xl bg-surface-container animate-pulse" />)}
        </div>
      ) : feed.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center">
            <span className="material-symbols-outlined text-outline" style={{ fontSize: '28px' }}>forum</span>
          </div>
          <p className="text-[14px] font-medium text-on-surface">No shared conversations yet</p>
          <p className="text-[13px] text-outline">When students share their AI chat summaries, they'll appear here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {feed.map(item => (
            <div key={item.session_id} className="bg-surface-container-lowest rounded-2xl shadow-warm p-md flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed text-[12px] font-medium shrink-0">
                      {item.student_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[14px] font-medium text-on-surface leading-tight">{item.student_name}</p>
                      <p className="text-[11px] text-on-surface-variant">
                        {item.branch || 'Branch not set'}{item.batch ? ` · ${item.batch}` : ''}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {item.escalation_level && item.escalation_level >= 2 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-error-container text-on-error-container">Sensitive</span>
                  )}
                  <span className="text-[11px] text-outline">
                    {new Date(item.shared_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              </div>

              <div className="bg-surface-container rounded-xl p-3">
                <p className="text-[13px] text-on-surface leading-relaxed">
                  {item.summary || 'No summary available.'}
                </p>
              </div>

              <div className="flex justify-end">
                {item.already_assigned ? (
                  <span className="text-[12px] text-outline flex items-center gap-1">
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check_circle</span>
                    Already assigned
                  </span>
                ) : (
                  <button
                    onClick={() => setAssigning(item)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-btn bg-primary text-on-primary text-[13px] font-medium hover:bg-primary/90 transition-colors"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>person_add</span>
                    Self-assign
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {assigning && (
        <SelfAssignModal
          item={assigning}
          onClose={() => setAssigning(null)}
          onSuccess={refetch}
        />
      )}
    </div>
  );
};
