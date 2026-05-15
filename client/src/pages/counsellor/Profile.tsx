import React, { useState } from 'react';
import { apiCall } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

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
  const { logout } = useAuth();
  const navigate = useNavigate();

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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-md mx-auto px-container-padding fade-in pt-lg">
        <div className="h-60 rounded-card bg-surface-container animate-pulse" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="w-full max-w-md mx-auto px-container-padding fade-in pt-lg">
        <div className="px-4 py-3 rounded-card bg-error-container text-on-error-container text-[14px]">
          {error || 'Profile not found.'}
        </div>
      </div>
    );
  }

  const initials = profile.full_name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="w-full max-w-md mx-auto px-container-padding fade-in">
      {/* Success banner */}
      {message && (
        <div className="mt-lg px-4 py-3 rounded-card bg-primary-container/20 text-on-primary-container text-[14px] mb-4">
          {message}
        </div>
      )}

      {/* Header section */}
      <section className="flex flex-col items-center mb-xl text-center mt-lg">
        <h2 className="font-display text-[30px] font-light text-on-surface mb-lg">My Profile</h2>

        {/* Avatar */}
        <div className="w-[72px] h-[72px] rounded-full bg-gradient-to-br from-primary-container to-surface-variant flex items-center justify-center mb-md shadow-warm">
          <span className="font-headline-lg text-headline-lg text-on-primary-container">{initials}</span>
        </div>

        <h3 className="font-headline-md text-[20px] font-light text-on-surface mb-1">{profile.full_name}</h3>
        <p className="font-body-sm text-[13px] text-outline mb-2">Counsellor · {profile.phone || 'No phone listed'}</p>

        <p className="font-label-caps text-[12px] text-primary bg-primary-fixed/30 px-3 py-1 rounded-full inline-block mt-1">
          {profile.capacity_limit != null ? `${profile.capacity_limit} slot capacity` : 'Capacity not set'} ·{' '}
          {profile.is_on_leave ? 'On leave' : 'Available'}
        </p>
      </section>

      {/* Specialisations card */}
      <section className="bg-surface-container-lowest rounded-card p-gutter mb-lg shadow-warm">
        <h4 className="font-label-caps text-[13px] text-outline mb-md uppercase tracking-wider">
          Your Specialisations
        </h4>
        <div className="flex flex-wrap gap-2">
          {profile.specialisation_tags?.length ? (
            profile.specialisation_tags.map(tag => (
              <span
                key={tag}
                className="px-4 py-2 bg-primary-container/20 text-on-primary-container font-body-sm text-sm rounded-full"
              >
                {tag}
              </span>
            ))
          ) : (
            <span className="px-4 py-2 bg-surface-container text-on-surface-variant font-body-sm text-sm rounded-full">
              No tags added
            </span>
          )}
        </div>
      </section>

      {/* Personality / description card */}
      <section className="bg-surface-container-lowest rounded-card p-gutter mb-lg shadow-warm">
        <h4 className="font-label-caps text-[13px] text-outline mb-md uppercase tracking-wider">
          How the manager describes you
        </h4>

        {profile.personality_description ? (
          <div className="border-l-2 border-primary-container pl-4 mb-md">
            <p className="font-body-md text-[14px] italic text-outline leading-relaxed">
              "{profile.personality_description}"
            </p>
          </div>
        ) : (
          <p className="font-body-sm text-[13px] text-outline-variant mb-md italic">No description added yet.</p>
        )}

        <p className="font-body-sm text-[11px] text-outline-variant mb-3">
          This is shown to the manager when assigning students.
        </p>
        <button
          onClick={openEdit}
          className="font-body-sm text-sm text-primary hover:opacity-80 transition-opacity flex items-center gap-1"
        >
          Request an edit
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '16px', fontVariationSettings: "'FILL' 0" }}
          >
            arrow_forward
          </span>
        </button>
      </section>

      {/* Stats card */}
      <section className="bg-surface-container-lowest rounded-card p-gutter mb-xl shadow-warm">
        <h4 className="font-label-caps text-[13px] text-outline mb-md uppercase tracking-wider">This Semester</h4>
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <span className="font-body-sm text-on-surface-variant">Capacity limit:</span>
            <span className="font-body-md text-on-surface">{profile.capacity_limit ?? 'Not set'}</span>
          </div>
          <div className="h-px w-full bg-surface-variant" />
          <div className="flex justify-between items-center">
            <span className="font-body-sm text-on-surface-variant">Availability:</span>
            <span className={`font-body-md ${profile.is_on_leave ? 'text-secondary' : 'text-primary'}`}>
              {profile.is_on_leave ? 'On leave' : 'Available'}
            </span>
          </div>
        </div>
      </section>

      {/* Sign out */}
      <div className="flex justify-center mb-xl pb-xl">
        <button
          onClick={handleLogout}
          className="font-body-sm text-[14px] text-tertiary hover:opacity-80 transition-opacity"
        >
          Sign out
        </button>
      </div>

      {/* Edit modal */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-inverse-surface/40 backdrop-blur-sm"
          onClick={e => e.target === e.currentTarget && setEditing(false)}
        >
          <form
            className="w-full max-w-md bg-surface-container-lowest rounded-t-[24px] shadow-warm-glow p-lg flex flex-col gap-4"
            onSubmit={submitRequest}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-headline-md text-[18px] font-medium text-on-surface">Request Profile Edit</h2>
                <p className="font-body-sm text-[12px] text-outline mt-0.5">Changes go to a manager for approval.</p>
              </div>
              <button
                type="button"
                className="p-2 rounded-full hover:bg-surface-container-low text-on-surface-variant transition-colors"
                onClick={() => setEditing(false)}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '20px', fontVariationSettings: "'FILL' 0" }}
                >
                  close
                </span>
              </button>
            </div>

            {/* Description field */}
            <label className="flex flex-col gap-1.5">
              <span className="font-label-caps text-[12px] text-outline uppercase tracking-wider">Description</span>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                className="w-full bg-surface rounded-input border border-surface-container px-4 py-3 font-body-md text-[14px] text-on-surface placeholder:text-outline-variant resize-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
                placeholder="Describe your counselling style…"
              />
            </label>

            {/* Tags field */}
            <label className="flex flex-col gap-1.5">
              <span className="font-label-caps text-[12px] text-outline uppercase tracking-wider">Tags</span>
              <input
                value={tags}
                onChange={e => setTags(e.target.value)}
                className="w-full bg-surface rounded-input border border-surface-container px-4 py-3 font-body-md text-[14px] text-on-surface placeholder:text-outline-variant focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
                placeholder="academic stress, grief, anxiety"
              />
            </label>

            {formError && (
              <div className="px-4 py-3 rounded-card bg-error-container text-on-error-container text-[13px]">
                {formError}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                className="flex-1 py-3 rounded-btn border border-surface-container font-body-sm text-[14px] text-on-surface-variant hover:bg-surface-container-low transition-colors"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
              <button
                className="flex-1 py-3 rounded-btn bg-primary text-on-primary font-body-sm text-[14px] flex justify-center items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60"
                disabled={saving}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '16px', fontVariationSettings: "'FILL' 0" }}
                >
                  send
                </span>
                {saving ? 'Sending…' : 'Submit request'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
