import React, { useState } from 'react';
import { Edit3, Send, X } from 'lucide-react';
import { apiCall } from '../../lib/api';
import { useApi } from '../../hooks/useApi';

interface CounsellorProfileData {
  id: string;
  full_name: string;
  phone: string | null;
  specialisation_tags: string[];
  personality_description: string | null;
  capacity_limit: number | null;
  is_on_leave: boolean;
}

export const CounsellorProfile: React.FC = () => {
  const { data: profile, isLoading, error } = useApi<CounsellorProfileData>('/api/counsellor/profile');
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const openEdit = () => {
    if (!profile) return;
    setDescription(profile.personality_description || '');
    setTags(profile.specialisation_tags?.join(', ') || '');
    setMessage('');
    setFormError('');
    setEditing(true);
  };

  const submitRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    setMessage('');

    const requestedChanges = {
      personality_description: description.trim(),
      specialisation_tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
    };

    if (!requestedChanges.personality_description && requestedChanges.specialisation_tags.length === 0) {
      setFormError('Add at least one requested change.');
      return;
    }

    setSaving(true);
    try {
      await apiCall('/api/counsellor/profile/edit-request', {
        method: 'POST',
        body: { requested_changes: requestedChanges },
      });
      setMessage('Edit request sent to your manager.');
      setEditing(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit request.');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fade-in counsellor-page">
        <div className="skeleton" style={{ height: 240, borderRadius: 8 }} />
      </div>
    );
  }

  if (error || !profile) {
    return <div className="fade-in counsellor-page"><div className="banner banner-warning">{error || 'Profile not found.'}</div></div>;
  }

  return (
    <div className="fade-in counsellor-page">
      <div className="counsellor-page-header">
        <div>
          <h1>Profile</h1>
          <p>Visible to managers when assigning students.</p>
        </div>
        <button className="btn btn-primary" onClick={openEdit}>
          <Edit3 size={16} />
          Request an edit
        </button>
      </div>

      {message && <div className="banner banner-info counsellor-banner">{message}</div>}

      <section className="counsellor-profile-card">
        <div className="counsellor-profile-top">
          <div className="mgr-user-avatar profile-avatar">{profile.full_name.charAt(0)}</div>
          <div>
            <h2>{profile.full_name}</h2>
            <p>{profile.phone || 'No phone listed'}</p>
          </div>
        </div>

        <div className="counsellor-profile-grid">
          <div>
            <div className="mgr-section-title">Description</div>
            <p>{profile.personality_description || 'No description added.'}</p>
          </div>
          <div>
            <div className="mgr-section-title">Tags</div>
            <div className="counsellor-dimension-row">
              {profile.specialisation_tags?.length
                ? profile.specialisation_tags.map(tag => <span key={tag} className="tag-chip">{tag}</span>)
                : <span className="tag-chip">No tags</span>}
            </div>
          </div>
          <div>
            <div className="mgr-section-title">Capacity</div>
            <p>{profile.capacity_limit ?? 'Not set'}</p>
          </div>
          <div>
            <div className="mgr-section-title">Availability</div>
            <p>{profile.is_on_leave ? 'On leave' : 'Available'}</p>
          </div>
        </div>
      </section>

      {editing && (
        <div className="mgr-modal-backdrop" onClick={e => e.target === e.currentTarget && setEditing(false)}>
          <form className="counsellor-edit-modal" onSubmit={submitRequest}>
            <div className="mgr-modal-header">
              <div>
                <h2>Request Profile Edit</h2>
                <p>Changes go to a manager for approval.</p>
              </div>
              <button type="button" className="mgr-logout-btn" onClick={() => setEditing(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="counsellor-edit-body">
              <label>
                Description
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={5} />
              </label>
              <label>
                Tags
                <input value={tags} onChange={e => setTags(e.target.value)} placeholder="academic stress, grief, anxiety" />
              </label>
              {formError && <div className="banner banner-warning">{formError}</div>}
            </div>
            <div className="mgr-modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={saving}>
                <Send size={16} />
                {saving ? 'Sending...' : 'Submit request'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
