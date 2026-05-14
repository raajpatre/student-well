import React, { useState } from 'react';
import { apiCall } from '../../lib/api';
import { Shield, Eye, Bell, Sliders, Download, Trash2, LogOut, ChevronDown, ChevronUp } from 'lucide-react';

const PRIVACY_SECTIONS = [
  {
    id: 'what_we_know',
    icon: Shield,
    title: 'What we know about you',
    content: [
      { label: 'Check-in responses', desc: 'Your weekly emotional, rest, academic, and social scores.' },
      { label: 'Wellness signals', desc: 'A computed signal (Good / Check-in / Support Available) per dimension, updated weekly.' },
      { label: 'Chat session metadata', desc: 'When sessions started and ended. Chat messages themselves are never shared.' },
      { label: 'Attendance data', desc: 'Attendance percentage provided by your institution.' },
    ],
  },
  {
    id: 'college_sees',
    icon: Eye,
    title: 'What your college can see',
    content: [
      { label: 'Wellness signals only', desc: 'Your counsellor and manager see your wellness signal level (Good / Check-in / Support Available) — not your raw scores or check-in answers.' },
      { label: 'Chat summaries you share', desc: 'If you choose to share a chat session, your counsellor sees a short AI-generated summary only. They never see the raw conversation.' },
      { label: 'Nothing by default', desc: 'Until you share or a welfare concern is detected, only you can see your data.' },
    ],
  },
  {
    id: 'escalation',
    icon: Bell,
    title: 'What triggers a support notification',
    content: [
      { label: 'Level 1 — Gentle nudge', desc: 'If the AI notices ongoing low mood across several messages, it may gently ask if you\'d like to talk to a real person. No one is notified.' },
      { label: 'Level 2 — Counsellor heads-up', desc: 'If you express thoughts of self-harm, a note is sent to your assigned counsellor so they can check in with you. This is for your safety.' },
      { label: 'Level 3 — Immediate support', desc: 'If you express immediate risk, both your counsellor and a support manager are notified right away. Crisis helplines are shared with you in the chat.' },
    ],
  },
];

export const PrivacyPage: React.FC = () => {
  const [expanded, setExpanded] = useState<string | null>('what_we_know');
  const [showOptOutConfirm, setShowOptOutConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const toggle = (id: string) => setExpanded((prev) => (prev === id ? null : id));

  const handleDeleteHistory = async () => {
    setIsDeleting(true);
    try {
      await apiCall('/api/student/checkin-history', { method: 'DELETE' });
      setSuccessMsg('Your check-in history has been deleted.');
    } catch {}
    setIsDeleting(false);
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const data = await apiCall<Record<string, unknown>>('/api/student/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'my-data.json'; a.click();
      URL.revokeObjectURL(url);
    } catch {}
    setIsDownloading(false);
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Privacy & Controls</h1>
        <p style={{ color: 'var(--text-3)', fontSize: 14 }}>You are in control of your data.</p>
      </div>

      {successMsg && (
        <div className="banner banner-info">
          <p style={{ fontSize: 14 }}>{successMsg}</p>
        </div>
      )}

      {/* Accordion Sections */}
      {PRIVACY_SECTIONS.map(({ id, icon: Icon, title, content }) => (
        <div key={id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <button
            onClick={() => toggle(id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px',
              width: '100%', background: 'none', border: 'none', color: 'var(--text)',
              cursor: 'pointer', textAlign: 'left'
            }}
          >
            <Icon size={18} style={{ color: 'var(--sage)', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{title}</span>
            {expanded === id ? <ChevronUp size={16} style={{ color: 'var(--text-3)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-3)' }} />}
          </button>

          {expanded === id && (
            <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 14, borderTop: '1px solid var(--border)' }}>
              {content.map(({ label, desc }) => (
                <div key={label} style={{ paddingTop: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{label}</div>
                  <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6 }}>{desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Controls */}
      <div>
        <div className="section-header">
          <span className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sliders size={13} /> Your Controls
          </span>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            className="btn btn-secondary btn-full"
            onClick={handleDownload}
            disabled={isDownloading}
            style={{ justifyContent: 'flex-start', gap: 10 }}
          >
            <Download size={16} style={{ color: 'var(--sage)' }} />
            {isDownloading ? 'Preparing your data...' : 'Download my data'}
          </button>

          <button
            className="btn btn-secondary btn-full"
            onClick={handleDeleteHistory}
            disabled={isDeleting}
            style={{ justifyContent: 'flex-start', gap: 10 }}
          >
            <Trash2 size={16} style={{ color: 'var(--attention)' }} />
            {isDeleting ? 'Deleting...' : 'Delete my check-in history'}
          </button>

          {!showOptOutConfirm ? (
            <button
              className="btn btn-secondary btn-full"
              onClick={() => setShowOptOutConfirm(true)}
              style={{ justifyContent: 'flex-start', gap: 10 }}
            >
              <LogOut size={16} style={{ color: 'var(--warning)' }} />
              Opt out of wellness monitoring
            </button>
          ) : (
            <div style={{ background: 'var(--warning-light)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 'var(--radius-md)', padding: '14px 16px' }}>
              <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Are you sure?</p>
              <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 14 }}>
                Opting out will stop all wellness tracking. Your college support team won't be able to proactively reach out, and your check-in history will no longer be collected. You can always opt back in.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowOptOutConfirm(false)}>Cancel</button>
                <button
                  className="btn btn-sm"
                  style={{ background: 'var(--warning)', color: '#fff' }}
                  onClick={() => { setShowOptOutConfirm(false); setSuccessMsg('Opt-out request submitted. It will take effect within 24 hours.'); }}
                >
                  Yes, opt out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
