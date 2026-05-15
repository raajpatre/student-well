import React, { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { apiCall } from '../../lib/api';

interface Counsellor {
  id: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  specialisation_tags: string[];
  personality_description: string | null;
  capacity_limit: number;
  current_caseload_count: number;
  is_on_leave: boolean;
}

const AddCounsellorForm: React.FC<{ onSuccess: () => void; onCancel: () => void }> = ({ onSuccess, onCancel }) => {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', personality_description: '', capacity_limit: '20', tags: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.full_name || !form.email) { setErr('Name and email are required.'); return; }
    setSaving(true); setErr('');
    try {
      await apiCall('/api/manager/counsellors', {
        method: 'POST',
        body: JSON.stringify({
          full_name: form.full_name,
          email: form.email,
          phone: form.phone || null,
          personality_description: form.personality_description || null,
          capacity_limit: parseInt(form.capacity_limit) || 20,
          specialisation_tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        }),
      });
      onSuccess();
    } catch (e: any) {
      setErr(e.message || 'Failed to create counsellor.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full bg-surface-container-low border border-outline-variant rounded-input px-3 py-2.5 text-on-surface text-[14px] font-sans focus:outline-none focus:border-primary transition-colors";

  return (
    <div className="bg-surface-container-lowest border border-primary/20 rounded-2xl p-lg mb-xl shadow-warm">
      <h3 className="text-[15px] font-medium text-on-surface mb-4">Add New Counsellor</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <input className={inputClass} placeholder="Full name *" value={form.full_name} onChange={set('full_name')} />
        <input className={inputClass} placeholder="Email address *" type="email" value={form.email} onChange={set('email')} />
        <input className={inputClass} placeholder="Phone" value={form.phone} onChange={set('phone')} />
        <input className={inputClass} placeholder="Capacity limit" type="number" value={form.capacity_limit} onChange={set('capacity_limit')} />
      </div>
      <input className={`${inputClass} mb-3`} placeholder="Specialisation tags (comma-separated, e.g. anxiety, academic)" value={form.tags} onChange={set('tags')} />
      <textarea className={`${inputClass} min-h-[70px] resize-y mb-3`} placeholder="Personality / approach description" value={form.personality_description} onChange={set('personality_description')} />
      {err && <p className="text-[12px] text-on-error-container mb-3">{err}</p>}
      <div className="flex gap-3 justify-end">
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 rounded-btn border border-outline-variant text-on-surface-variant text-[14px] font-medium hover:bg-surface-container transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="px-4 py-2 rounded-btn bg-primary text-on-primary text-[14px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? 'Creating…' : 'Create Counsellor'}
        </button>
      </div>
    </div>
  );
};

const EditInline: React.FC<{ counsellor: Counsellor; onDone: () => void }> = ({ counsellor, onDone }) => {
  const [form, setForm] = useState({
    personality_description: counsellor.personality_description || '',
    capacity_limit: String(counsellor.capacity_limit),
    is_on_leave: counsellor.is_on_leave,
    tags: counsellor.specialisation_tags?.join(', ') || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiCall(`/api/manager/counsellors/${counsellor.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          personality_description: form.personality_description || null,
          capacity_limit: parseInt(form.capacity_limit) || 20,
          is_on_leave: form.is_on_leave,
          specialisation_tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        }),
      });
      onDone();
    } catch { /* ignore */ } finally { setSaving(false); }
  };

  const inputClass = "w-full bg-surface-container-low border border-outline-variant rounded-input px-2.5 py-1.5 text-on-surface text-[12px] font-sans focus:outline-none focus:border-primary transition-colors mb-2";

  return (
    <div className="mt-3 pt-3 border-t border-custom-divider/50">
      <input className={inputClass} placeholder="Tags (comma-separated)" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
      <textarea className={`${inputClass} min-h-[56px] resize-y`} placeholder="Description" value={form.personality_description} onChange={e => setForm(f => ({ ...f, personality_description: e.target.value }))} />
      <div className="flex items-center gap-3 mb-2">
        <input
          className="w-20 bg-surface-container-low border border-outline-variant rounded-input px-2.5 py-1.5 text-on-surface text-[12px] font-sans focus:outline-none focus:border-primary"
          type="number" placeholder="Capacity" value={form.capacity_limit} onChange={e => setForm(f => ({ ...f, capacity_limit: e.target.value }))}
        />
        <label className="flex items-center gap-1.5 text-[12px] text-on-surface-variant cursor-pointer">
          <input type="checkbox" checked={form.is_on_leave} onChange={e => setForm(f => ({ ...f, is_on_leave: e.target.checked }))} className="accent-primary" />
          On Leave
        </label>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 rounded-btn bg-primary text-on-primary text-[12px] font-medium flex items-center gap-1 hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onDone}
          className="px-3 py-1.5 rounded-btn border border-outline-variant text-on-surface-variant text-[12px] font-medium flex items-center gap-1 hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
          Cancel
        </button>
      </div>
    </div>
  );
};

const statusBadge = (c: Counsellor) => {
  if (c.is_on_leave) return { label: 'On Leave', cls: 'bg-tertiary-fixed text-tertiary border border-tertiary-fixed-dim/50' };
  if (c.current_caseload_count >= c.capacity_limit) return { label: 'At Capacity', cls: 'bg-surface-variant text-on-surface-variant border border-outline-variant/30' };
  return { label: 'Available', cls: 'bg-primary-fixed/50 text-primary border border-primary/20' };
};

export const CounsellorPage: React.FC = () => {
  const { data, isLoading, refetch } = useApi<Counsellor[]>('/api/manager/counsellors');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const counsellors = data || [];

  return (
    <div className="px-8 py-8 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between mb-xl">
        <div>
          <h1 className="text-[22px] font-light text-on-surface mb-1">Counsellors</h1>
          <p className="text-[13px] text-on-surface-variant">{counsellors.length} registered</p>
        </div>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-xs px-md py-2 rounded-xl bg-primary text-on-primary text-[14px] font-medium hover:bg-primary/90 transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add</span>
          Add Counsellor
        </button>
      </div>

      {showAdd && (
        <AddCounsellorForm
          onSuccess={() => { setShowAdd(false); refetch(); }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-xl">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-52 rounded-2xl bg-surface-container animate-pulse" />
          ))}
        </div>
      ) : counsellors.length === 0 ? (
        <div className="bg-surface-container-lowest border border-dashed border-outline-variant rounded-2xl p-xl flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary-fixed/30 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined">person_add</span>
          </div>
          <p className="text-on-surface-variant text-[14px]">No counsellors yet. Add one above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-xl">
          {counsellors.map(c => {
            const badge = statusBadge(c);
            const caseloadPct = Math.min(100, (c.current_caseload_count / c.capacity_limit) * 100);
            const initials = c.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
            return (
              <div
                key={c.id}
                className={`bg-surface-container-lowest rounded-2xl p-md shadow-warm flex flex-col gap-md ${c.is_on_leave ? 'opacity-80' : ''}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-md">
                    <div className="w-[56px] h-[56px] rounded-full bg-gradient-to-br from-primary-fixed to-secondary-fixed flex items-center justify-center text-on-surface text-[18px] font-medium flex-shrink-0">
                      {initials}
                    </div>
                    <div>
                      <h3 className="text-[15px] font-medium text-on-surface">{c.full_name}</h3>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-label-caps text-[11px] font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditing(editing === c.id ? null : c.id)}
                    className="p-1 text-on-surface-variant hover:text-on-surface transition-colors"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>more_vert</span>
                  </button>
                </div>

                {/* Specialisation tags */}
                {c.specialisation_tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {c.specialisation_tags.map(t => (
                      <span key={t} className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[11px] border border-surface-variant/50">
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {/* Description */}
                {c.personality_description && (
                  <div className="bg-surface-container-low rounded-lg p-3 border border-surface-variant/30">
                    <p className="text-[13px] italic text-on-surface-variant leading-relaxed">"{c.personality_description}"</p>
                  </div>
                )}

                {/* Capacity bar */}
                <div className="flex flex-col gap-1 mt-auto">
                  <div className="flex justify-between items-end">
                    <span className="text-[13px] text-on-surface-variant">Caseload</span>
                    <span className={`text-label-caps text-[11px] ${c.current_caseload_count >= c.capacity_limit ? 'text-on-error-container' : 'text-on-surface-variant'}`}>
                      {c.current_caseload_count} / {c.capacity_limit} students
                    </span>
                  </div>
                  <div className="w-full h-2 bg-surface-variant rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${c.current_caseload_count >= c.capacity_limit ? 'bg-outline' : 'bg-primary-container'}`}
                      style={{ width: `${caseloadPct}%` }}
                    />
                  </div>
                </div>

                <div className="h-px w-full bg-surface-variant/50" />

                {/* Footer actions */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setEditing(editing === c.id ? null : c.id)}
                    className="text-[13px] text-secondary px-3 py-1.5 rounded-lg border border-surface-variant/50 hover:bg-surface-container-low transition-colors font-medium"
                  >
                    Edit
                  </button>
                  <button className={`text-[13px] font-medium transition-colors ${c.is_on_leave ? 'text-on-surface-variant cursor-not-allowed' : 'text-primary hover:text-primary/80'}`}>
                    View students
                  </button>
                </div>

                {/* Inline edit */}
                {editing === c.id && (
                  <EditInline counsellor={c} onDone={() => { setEditing(null); refetch(); }} />
                )}
              </div>
            );
          })}

          {/* Add placeholder card */}
          {!showAdd && (
            <div
              onClick={() => setShowAdd(true)}
              className="bg-surface-container-lowest border border-dashed border-outline-variant rounded-2xl p-md flex items-center justify-center cursor-pointer hover:bg-surface-container-low transition-colors group min-h-[200px]"
            >
              <div className="flex flex-col items-center gap-xs py-xl">
                <div className="w-12 h-12 rounded-full bg-primary-fixed/30 text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined">person_add</span>
                </div>
                <span className="text-[14px] text-on-surface-variant">Add new counsellor</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
