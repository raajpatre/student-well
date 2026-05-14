import React, { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { apiCall } from '../../lib/api';
import { Bell, Globe, Clock, Save } from 'lucide-react';

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
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

  const Section: React.FC<{ icon: React.ElementType; title: string; children: React.ReactNode }> = ({ icon: Icon, title, children }) => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Icon size={16} style={{ color: 'var(--accent)' }} />
        <span className="section-title">{title}</span>
      </div>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {children}
      </div>
    </div>
  );

  const SettingRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ fontSize: 14 }}>{label}</span>
      {children}
    </div>
  );

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 140, borderRadius: 'var(--radius-lg)' }} />)}
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Settings</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Personalise your experience</p>
      </div>

      <Section icon={Clock} title="Check-in Preferences">
        <SettingRow label="Reminder day">
          <select
            value={current?.checkin_day || 'Monday'}
            onChange={(e) => update('checkin_day', e.target.value)}
            style={{ width: 130 }}
          >
            {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </SettingRow>
        <SettingRow label="Reminder time">
          <select
            value={current?.checkin_time || '18:00'}
            onChange={(e) => update('checkin_time', e.target.value)}
            style={{ width: 130 }}
          >
            {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </SettingRow>
        <SettingRow label="Delivery method">
          <select
            value={current?.delivery_method || 'in_app'}
            onChange={(e) => update('delivery_method', e.target.value)}
            style={{ width: 130 }}
          >
            {DELIVERY.map((d) => <option key={d} value={d}>{DELIVERY_LABELS[d]}</option>)}
          </select>
        </SettingRow>
      </Section>

      <Section icon={Globe} title="Language">
        <div style={{ display: 'flex', gap: 10, padding: '14px 0' }}>
          {LANGUAGES.map(({ code, label }) => (
            <button
              key={code}
              onClick={() => update('language', code)}
              className={`btn btn-sm ${current?.language === code ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1 }}
            >
              {label}
            </button>
          ))}
        </div>
      </Section>

      <Section icon={Bell} title="Notifications">
        <SettingRow label="Enable notifications">
          <button
            onClick={() => update('notifications_enabled', !(current?.notifications_enabled ?? true))}
            style={{
              width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
              background: (current?.notifications_enabled ?? true) ? 'var(--accent)' : 'var(--surface-raised)',
              position: 'relative', transition: 'background 0.2s'
            }}
          >
            <div style={{
              width: 18, height: 18, borderRadius: '50%', background: '#fff',
              position: 'absolute', top: 3,
              left: (current?.notifications_enabled ?? true) ? 23 : 3,
              transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
            }} />
          </button>
        </SettingRow>
      </Section>

      <button
        className="btn btn-primary btn-full"
        onClick={save}
        disabled={isSaving || !prefs}
        style={{ opacity: !prefs ? 0.5 : 1 }}
      >
        <Save size={16} />
        {isSaving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Changes'}
      </button>

      <div className="divider" />

      <div className="card" style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 12 }}>
          To change your password, you'll be redirected to a secure page.
        </p>
        <button
          className="btn btn-secondary btn-full"
          onClick={() => alert('Password reset: Coming soon')}
        >
          Change Password
        </button>
      </div>
    </div>
  );
};
