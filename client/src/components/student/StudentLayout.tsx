import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, MessageCircle, TrendingUp, Users, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { to: '/student/dashboard', icon: LayoutDashboard, label: 'Home' },
  { to: '/student/chat', icon: MessageCircle, label: 'Chat' },
  { to: '/student/trends', icon: TrendingUp, label: 'Trends' },
  { to: '/student/spaces', icon: Users, label: 'Spaces' },
  { to: '/student/privacy', icon: Shield, label: 'Privacy' },
];

export const StudentLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="student-layout">
      {/* Top nav */}
      <nav className="student-topnav">
        <span className="brand">Student<span>Well</span></span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{user?.full_name?.split(' ')[0]}</span>
          <button
            onClick={handleLogout}
            className="btn btn-ghost btn-sm"
            style={{ padding: '6px 12px', fontSize: 13 }}
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main className="student-main">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="student-bottom-nav">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
          >
            <Icon size={22} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};
