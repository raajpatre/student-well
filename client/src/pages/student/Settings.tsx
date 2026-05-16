import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { apiCall } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

interface NewtonStatus {
  connected: boolean;
  course_name?: string;
  last_sync_at?: string | null;
  last_sync_status?: string | null;
  expires_at?: number | null;
  days_until_expiry?: number | null;
  expiring_soon?: boolean;
  attendance_pct?: number | null;
  assignment_completion_pct?: number | null;
}

function useNewtonLink() {
  const [status, setStatus] = useState<NewtonStatus>({ connected: false });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const next = await apiCall<NewtonStatus>('/api/student/newton/status');
      setStatus(next);
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const connect = async (accessToken: string, expiresAt?: number) => {
    await apiCall('/api/student/newton/connect', {
      method: 'POST',
      body: expiresAt ? { access_token: accessToken, expires_at: expiresAt } : { access_token: accessToken },
    });
    await refresh();
  };

  const disconnect = async () => {
    await apiCall('/api/student/newton/disconnect', { method: 'DELETE' });
    setStatus({ connected: false });
  };

  return { status, loading, connect, disconnect, refresh };
}

interface Preferences {
  checkin_day: string;
  checkin_time: string;
  delivery_method: string;
  language: string;
  notifications_enabled: boolean;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIMES = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];
const DELIVERY = ['in_app', 'whatsapp', 'email'];
const DELIVERY_LABELS: Record<string, string> = { in_app: 'In-app', whatsapp: 'WhatsApp', email: 'Email' };
const LANGUAGES = [{ code: 'en', label: 'English' }, { code: 'hi', label: 'हिंदी (Hindi)' }];

export const SettingsPage: React.FC = () => {
  const { data, isLoading } = useApi<{ preferences: Preferences }>('/api/student/preferences');
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Newton integration
  const newton = useNewtonLink();
  const [showNewtonModal, setShowNewtonModal] = useState(false);
  const [newtonInput, setNewtonInput] = useState('');
  const [newtonError, setNewtonError] = useState('');
  const [newtonConnecting, setNewtonConnecting] = useState(false);

  const current = prefs || data?.preferences;

  const update = (key: keyof Preferences, val: string | boolean) => {
    const base = current || {
      checkin_day: 'Monday',
      checkin_time: '18:00',
      delivery_method: 'in_app',
      language: 'en',
      notifications_enabled: true,
    };
    setPrefs({ ...base, [key]: val });
    setSaved(false);
  };

  const save = async () => {
    if (!current) return;
    setIsSaving(true);
    try {
      await apiCall('/api/student/preferences', { method: 'PATCH', body: current });
      setSaved(true);
    } catch {}
    setIsSaving(false);
  };

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'SW';

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5 pb-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[140px] rounded-[18px] bg-surface-container-high animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-xl pb-8">
      {/* Profile Section */}
      <section className="flex flex-col items-center text-center pt-2">
        <div className="w-[60px] h-[60px] rounded-full bg-gradient-to-br from-primary-container to-primary flex items-center justify-center text-on-primary text-xl font-medium shadow-warm mb-4">
          {initials}
        </div>
        <h2 className="text-[17px] font-medium text-on-surface mb-1">{user?.full_name || 'Student'}</h2>
        <p className="text-[13px] text-outline mb-3">Student</p>
      </section>

      {/* Settings Groups */}
      <div className="space-y-6">
        {/* Check-in Preferences */}
        <section>
          <h3 className="font-label-caps text-label-caps text-outline mb-2 px-2">CHECK-IN PREFERENCES</h3>
          <div className="bg-surface-container-lowest rounded-[18px] shadow-warm overflow-hidden">
            {/* Delivery */}
            <div className="w-full flex items-center justify-between px-4 h-12 hover:bg-surface-container-low transition-colors">
              <span className="text-[14px] text-on-surface font-medium">Delivery</span>
              <div className="flex items-center gap-2">
                <select
                  value={current?.delivery_method || 'in_app'}
                  onChange={(e) => update('delivery_method', e.target.value)}
                  className="text-[14px] text-outline bg-transparent border-none outline-none cursor-pointer"
                >
                  {DELIVERY.map((d) => <option key={d} value={d}>{DELIVERY_LABELS[d]}</option>)}
                </select>
                <span className="material-symbols-outlined text-[20px] text-outline">chevron_right</span>
              </div>
            </div>
            <div className="h-px w-full bg-surface-variant" />
            {/* Day */}
            <div className="w-full flex items-center justify-between px-4 h-12 hover:bg-surface-container-low transition-colors">
              <span className="text-[14px] text-on-surface font-medium">Day</span>
              <div className="flex items-center gap-2">
                <select
                  value={current?.checkin_day || 'Monday'}
                  onChange={(e) => update('checkin_day', e.target.value)}
                  className="text-[14px] text-outline bg-transparent border-none outline-none cursor-pointer"
                >
                  {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
                <span className="material-symbols-outlined text-[20px] text-outline">chevron_right</span>
              </div>
            </div>
            <div className="h-px w-full bg-surface-variant" />
            {/* Time */}
            <div className="w-full flex items-center justify-between px-4 h-12 hover:bg-surface-container-low transition-colors">
              <span className="text-[14px] text-on-surface font-medium">Time</span>
              <div className="flex items-center gap-2">
                <select
                  value={current?.checkin_time || '18:00'}
                  onChange={(e) => update('checkin_time', e.target.value)}
                  className="text-[14px] text-outline bg-transparent border-none outline-none cursor-pointer"
                >
                  {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <span className="material-symbols-outlined text-[20px] text-outline">chevron_right</span>
              </div>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section>
          <h3 className="font-label-caps text-label-caps text-outline mb-2 px-2">NOTIFICATIONS</h3>
          <div className="bg-surface-container-lowest rounded-[18px] shadow-warm overflow-hidden">
            <div className="w-full flex items-center justify-between px-4 h-12 hover:bg-surface-container-low transition-colors">
              <span className="text-[14px] text-on-surface font-medium">Weekly reminder</span>
              <button
                onClick={() => update('notifications_enabled', !(current?.notifications_enabled ?? true))}
                className={`relative inline-flex h-6 w-11 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${(current?.notifications_enabled ?? true) ? 'bg-primary-container' : 'bg-surface-variant'}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${(current?.notifications_enabled ?? true) ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Appearance */}
        <section>
          <h3 className="font-label-caps text-label-caps text-outline mb-2 px-2">APPEARANCE</h3>
          <div className="bg-surface-container-lowest rounded-[18px] shadow-warm overflow-hidden">
            <div className="w-full flex items-center justify-between px-4 h-12 hover:bg-surface-container-low transition-colors">
              <span className="text-[14px] text-on-surface font-medium">Language</span>
              <div className="flex items-center gap-2">
                <select
                  value={current?.language || 'en'}
                  onChange={(e) => update('language', e.target.value)}
                  className="text-[14px] text-outline bg-transparent border-none outline-none cursor-pointer"
                >
                  {LANGUAGES.map(({ code, label }) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
                <span className="material-symbols-outlined text-[20px] text-outline">chevron_right</span>
              </div>
            </div>
          </div>
        </section>

        {/* Connected Apps */}
        <section>
          <h3 className="font-label-caps text-label-caps text-outline mb-2 px-2">CONNECTED APPS</h3>
          <div className="bg-surface-container-lowest rounded-[18px] shadow-warm overflow-hidden">
            <div className="w-full flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-light flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px] text-primary">school</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[14px] text-on-surface font-medium leading-tight">Newton</span>
                  <span className="text-[12px] text-outline mt-0.5">
                    {newton.loading
                      ? 'Checking…'
                      : newton.status.connected
                        ? `Connected — ${newton.status.course_name ?? 'course'}`
                        : 'Academic platform — not connected'}
                  </span>
                </div>
              </div>
              {newton.status.connected ? (
                <button
                  onClick={() => { void newton.disconnect(); }}
                  className="text-[13px] text-tertiary font-medium px-3 py-1.5 rounded-btn hover:bg-error-container/40 transition-colors"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={() => { setNewtonInput(''); setNewtonError(''); setShowNewtonModal(true); }}
                  className="text-[13px] text-primary font-medium px-3 py-1.5 rounded-btn bg-primary-fixed hover:bg-primary-fixed-dim transition-colors"
                >
                  Connect
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Account */}
        <section>
          <h3 className="font-label-caps text-label-caps text-outline mb-2 px-2">ACCOUNT</h3>
          <div className="bg-surface-container-lowest rounded-[18px] shadow-warm overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 h-12 hover:bg-surface-container-low transition-colors text-left group"
              onClick={() => alert('Password reset: Coming soon')}
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-outline text-[20px]">lock</span>
                <span className="text-[14px] text-on-surface font-medium">Change password</span>
              </div>
              <span className="material-symbols-outlined text-outline text-[20px] group-hover:translate-x-1 transition-transform">chevron_right</span>
            </button>
            <div className="h-px w-full bg-surface-variant" />
            <button
              className="w-full flex items-center justify-between px-4 h-12 hover:bg-surface-container-low transition-colors text-left group"
              onClick={() => navigate('/student/privacy')}
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-[20px]">shield</span>
                <span className="text-[14px] text-primary font-medium">Privacy settings</span>
              </div>
              <span className="material-symbols-outlined text-outline text-[20px] group-hover:translate-x-1 transition-transform">chevron_right</span>
            </button>
            <div className="h-px w-full bg-surface-variant" />
            <button
              className="w-full flex items-center justify-between px-4 h-12 hover:bg-error-container transition-colors text-left group"
              onClick={() => { logout(); navigate('/login'); }}
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-tertiary text-[20px]">logout</span>
                <span className="text-[14px] text-tertiary font-medium">Sign out</span>
              </div>
            </button>
          </div>
        </section>
      </div>

      {/* Save button */}
      <button
        className="w-full h-[48px] bg-primary-container text-on-primary rounded-btn font-body-md hover:bg-primary transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
        onClick={save}
        disabled={isSaving || !prefs}
      >
        <span className="material-symbols-outlined text-[18px]">save</span>
        {isSaving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Changes'}
      </button>

      {/* Newton Connect Modal */}
      {showNewtonModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-on-surface/30 backdrop-blur-sm"
            onClick={() => setShowNewtonModal(false)}
          />
          {/* Sheet */}
          <div className="relative w-full max-w-lg bg-surface-container-lowest rounded-t-[24px] p-6 shadow-warm-glow">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-light flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px] text-primary">school</span>
                </div>
                <h3 className="text-[17px] font-medium text-on-surface">Connect Newton</h3>
              </div>
              <button
                onClick={() => setShowNewtonModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-low transition-colors"
              >
                <span className="material-symbols-outlined text-[20px] text-outline">close</span>
              </button>
            </div>

            <ol className="text-[12px] text-on-surface-variant mb-4 leading-relaxed list-decimal pl-4 space-y-1">
              <li>In your terminal, run <code className="px-1 rounded bg-surface-container-low">npx @newtonschool/newton-mcp@latest login</code></li>
              <li>Open <code className="px-1 rounded bg-surface-container-low">~/.newton-mcp/credentials.json</code></li>
              <li>Copy the <code className="px-1 rounded bg-surface-container-low">access_token</code> value and paste it below.</li>
            </ol>

            <input
              type="password"
              placeholder="Paste your access_token"
              value={newtonInput}
              onChange={(e) => { setNewtonInput(e.target.value); setNewtonError(''); }}
              autoComplete="off"
              spellCheck={false}
              className="w-full h-[44px] bg-background border border-custom-divider rounded-input px-4 text-[14px] text-on-surface placeholder:text-outline focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-colors mb-2 font-mono"
            />

            {newtonError && (
              <p className="text-[12px] text-on-error-container mb-3">{newtonError}</p>
            )}

            <button
              disabled={newtonConnecting}
              onClick={async () => {
                const token = newtonInput.trim();
                if (!token) {
                  setNewtonError('Please paste your access_token.');
                  return;
                }
                setNewtonConnecting(true);
                setNewtonError('');
                try {
                  await newton.connect(token);
                  setShowNewtonModal(false);
                } catch (err: any) {
                  setNewtonError(err?.message ?? 'Could not connect — please try again.');
                } finally {
                  setNewtonConnecting(false);
                }
              }}
              className="w-full h-[48px] bg-primary-container text-on-primary rounded-btn font-body-md hover:bg-primary transition-colors shadow-sm mt-2 disabled:opacity-50"
            >
              {newtonConnecting ? 'Connecting…' : 'Connect Account'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
