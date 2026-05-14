import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../hooks/useApi';
import { StatusBadge } from '../../components/student/StatusBadge';
import { MessageCircle, TrendingUp, Users, Shield, ChevronRight, Bell } from 'lucide-react';

interface WellnessSignals {
  academic_status: string | null;
  emotional_status: string | null;
  social_status: string | null;
  academic_score: number | null;
  emotional_score: number | null;
  social_score: number | null;
  academic_suggestion: string | null;
  emotional_suggestion: string | null;
  social_suggestion: string | null;
  last_updated: string | null;
}

interface CheckinStatus {
  pending: boolean;
  last_checkin: string | null;
}

interface StudentInfo {
  counsellor_id: string | null;
  flag_status: string | null;
  wellness_signals: WellnessSignals | null;
}

const WELLNESS_CARDS = [
  {
    key: 'academic' as const,
    label: 'Academic Momentum',
    icon: '📚',
    statusKey: 'academic_status' as const,
    scoreKey: 'academic_score' as const,
    suggestionKey: 'academic_suggestion' as const,
  },
  {
    key: 'emotional' as const,
    label: 'Emotional Baseline',
    icon: '💙',
    statusKey: 'emotional_status' as const,
    scoreKey: 'emotional_score' as const,
    suggestionKey: 'emotional_suggestion' as const,
  },
  {
    key: 'social' as const,
    label: 'Social Connection',
    icon: '🤝',
    statusKey: 'social_status' as const,
    scoreKey: 'social_score' as const,
    suggestionKey: 'social_suggestion' as const,
  },
];

const quickLinks = [
  { to: '/student/chat', icon: MessageCircle, label: 'Talk to AI' },
  { to: '/student/spaces', icon: Users, label: 'Spaces' },
  { to: '/student/trends', icon: TrendingUp, label: 'My Trends' },
  { to: '/student/privacy', icon: Shield, label: 'Privacy' },
];

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'No data yet';
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: studentInfo, isLoading: loadingInfo } = useApi<StudentInfo>('/api/student/me');
  const { data: checkinStatus, isLoading: loadingCheckin } = useApi<CheckinStatus>('/api/checkins/status');

  const signals = studentInfo?.wellness_signals;
  const hasPendingCheckin = checkinStatus?.pending;
  const showCounsellorBanner =
    studentInfo?.counsellor_id && studentInfo?.flag_status === 'pending_contact';

  const isLoading = loadingInfo || loadingCheckin;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Greeting */}
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
          Hey, {user?.full_name?.split(' ')[0] || 'there'} 👋
        </h1>
        <p style={{ color: 'var(--text-3)', fontSize: 14 }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Counsellor Banner */}
      {showCounsellorBanner && (
        <div className="banner banner-info" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <Bell size={18} style={{ color: 'var(--sage)', flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 14, lineHeight: 1.5 }}>
            Someone from the support team will be in touch with you soon. You're not alone in this.
          </p>
        </div>
      )}

      {/* Pending Check-in */}
      {!loadingCheckin && hasPendingCheckin && (
        <div
          className="card"
          style={{
            background: 'linear-gradient(135deg, rgba(124, 111, 247, 0.15), rgba(124, 111, 247, 0.05))',
            borderColor: 'var(--border-focus)',
            cursor: 'pointer'
          }}
          onClick={() => navigate('/student/checkin')}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 20, marginBottom: 6 }}>🌱</div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>This week's check-in is ready</h3>
              <p style={{ fontSize: 13, color: 'var(--text-3)' }}>Takes about 90 seconds</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/student/checkin')}>
              Check in now
            </button>
          </div>
        </div>
      )}

      {/* Wellness Cards */}
      <div>
        <div className="section-header">
          <span className="section-title">Your Wellbeing</span>
          {signals?.last_updated && (
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
              Updated {timeAgo(signals.last_updated)}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {isLoading
            ? [1, 2, 3].map((i) => (
                <div key={i} className="skeleton" style={{ height: 100, borderRadius: 'var(--radius-lg)' }} />
              ))
            : WELLNESS_CARDS.map(({ key, label, icon, statusKey, suggestionKey }) => (
                <div key={key} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 20 }}>{icon}</span>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{label}</span>
                    </div>
                    <StatusBadge status={signals?.[statusKey] as any} />
                  </div>
                  {signals?.[suggestionKey] && (
                    <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>
                      {signals[suggestionKey]}
                    </p>
                  )}
                  {!signals && (
                    <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
                      Complete your first check-in to see insights here.
                    </p>
                  )}
                </div>
              ))}
        </div>
      </div>

      {/* Quick Access */}
      <div>
        <div className="section-header">
          <span className="section-title">Quick Access</span>
        </div>
        <div className="grid-2">
          {quickLinks.map(({ to, icon: Icon, label }) => (
            <button
              key={to}
              className="card btn-secondary"
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                cursor: 'pointer', justifyContent: 'flex-start', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', width: '100%'
              }}
              onClick={() => navigate(to)}
            >
              <Icon size={18} style={{ color: 'var(--sage)' }} />
              <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
              <ChevronRight size={14} style={{ color: 'var(--text-3)', marginLeft: 'auto' }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
