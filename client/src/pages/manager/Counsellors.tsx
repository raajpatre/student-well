import React, { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { apiCall } from '../../lib/api';
import { Plus, Edit2, Check, X } from 'lucide-react';

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

  const fieldStyle: React.CSSProperties = {
    width: '100%', background: 'var(--surface-raised)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', padding: '9px 12px', color: 'var(--text)',
    fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 10,
  };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--accent-border)', borderRadius: 'var(--radius-lg)', padding: 20, marginBottom: 20 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Add New Counsellor</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
        <input style={fieldStyle} placeholder="Full name *" value={form.full_name} onChange={set('full_name')} />
        <input style={fieldStyle} placeholder="Email address *" type="email" value={form.email} onChange={set('email')} />
        <input style={fieldStyle} placeholder="Phone" value={form.phone} onChange={set('phone')} />
        <input style={fieldStyle} placeholder="Capacity limit" type="number" value={form.capacity_limit} onChange={set('capacity_limit')} />
      </div>
      <input style={fieldStyle} placeholder="Specialisation tags (comma-separated, e.g. anxiety, academic)" value={form.tags} onChange={set('tags')} />
      <textarea style={{ ...fieldStyle, minHeight: 70, resize: 'vertical' }} placeholder="Personality / approach description" value={form.personality_description} onChange={set('personality_description')} />
      {err && <p style={{ fontSize: 12, color: '#f97316', marginBottom: 8 }}>{err}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Creating…' : 'Create Counsellor'}</button>
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

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface-raised)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', padding: '6px 10px', color: 'var(--text)',
    fontSize: 12, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box', marginBottom: 8,
  };

  return (
    <div style={{ marginTop: 10 }}>
      <input style={inputStyle} placeholder="Tags (comma-separated)" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
      <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} placeholder="Description" value={form.personality_description} onChange={e => setForm(f => ({ ...f, personality_description: e.target.value }))} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
        <input style={{ ...inputStyle, width: 80, marginBottom: 0 }} type="number" placeholder="Capacity" value={form.capacity_limit} onChange={e => setForm(f => ({ ...f, capacity_limit: e.target.value }))} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.is_on_leave} onChange={e => setForm(f => ({ ...f, is_on_leave: e.target.checked }))} />
          On Leave
        </label>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving} style={{ padding: '5px 12px', fontSize: 12 }}>
          <Check size={12} /> {saving ? 'Saving…' : 'Save'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onDone} style={{ padding: '5px 12px', fontSize: 12 }}>
          <X size={12} /> Cancel
        </button>
      </div>
    </div>
  );
};

export const CounsellorPage: React.FC = () => {
  const { data, isLoading, refetch } = useApi<Counsellor[]>('/api/manager/counsellors');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const counsellors = data || [];

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Counsellors</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{counsellors.length} registered</p>
        </div>
        <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => setShowAdd(v => !v)}>
          <Plus size={16} /> Add Counsellor
        </button>
      </div>

      {showAdd && <AddCounsellorForm onSuccess={() => { setShowAdd(false); refetch(); }} onCancel={() => setShowAdd(false)} />}

      {isLoading
        ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 180, borderRadius: 12 }} />)}
          </div>
        : counsellors.length === 0
          ? <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No counsellors yet. Add one above.</p>
          : (
            <div className="mgr-counsellor-grid">
              {counsellors.map(c => (
                <div key={c.id} className={`counsellor-card${c.is_on_leave ? ' on-leave' : ''}`}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-light)',
                        color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: 14, flexShrink: 0,
                      }}>{c.full_name.charAt(0)}</div>
                      <div>
                        <div className="counsellor-card-name">{c.full_name}</div>
                        {c.is_on_leave && <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600 }}>ON LEAVE</span>}
                      </div>
                    </div>
                    <button className="mgr-logout-btn" onClick={() => setEditing(editing === c.id ? null : c.id)}>
                      <Edit2 size={14} />
                    </button>
                  </div>

                  {c.personality_description && (
                    <p className="counsellor-card-desc">{c.personality_description}</p>
                  )}

                  {/* Capacity */}
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Caseload</span>
                    <span style={{ fontWeight: 600, color: c.current_caseload_count >= c.capacity_limit ? '#f97316' : 'var(--text)' }}>
                      {c.current_caseload_count} / {c.capacity_limit}
                    </span>
                  </div>
                  <div className="counsellor-capacity-bar">
                    <div className="counsellor-capacity-fill" style={{
                      width: `${Math.min(100, (c.current_caseload_count / c.capacity_limit) * 100)}%`,
                      background: c.current_caseload_count >= c.capacity_limit ? '#f97316' : 'var(--accent)',
                    }} />
                  </div>

                  {/* Tags */}
                  {c.specialisation_tags?.length > 0 && (
                    <div className="counsellor-pick-tags" style={{ marginTop: 8 }}>
                      {c.specialisation_tags.map(t => <span key={t} className="tag-chip">{t}</span>)}
                    </div>
                  )}

                  {/* Inline edit */}
                  {editing === c.id && (
                    <EditInline counsellor={c} onDone={() => { setEditing(null); refetch(); }} />
                  )}
                </div>
              ))}
            </div>
          )
      }
    </div>
  );
};
