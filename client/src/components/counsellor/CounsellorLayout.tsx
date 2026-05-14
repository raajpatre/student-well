import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ChevronRight, ClipboardList, LogOut, Menu, UserCircle, X } from 'lucide-react';

const navItems = [
  { to: '/counsellor/dashboard', icon: ClipboardList, label: 'My Students' },
  { to: '/counsellor/profile', icon: UserCircle, label: 'Profile' },
];

export const CounsellorLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="mgr-layout">
      {sidebarOpen && <div className="mgr-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`mgr-sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="mgr-sidebar-header">
          <span className="brand">Student<span>Well</span></span>
          <button className="mgr-close-btn" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="mgr-sidebar-role">Counsellor Portal</div>

        <nav className="mgr-nav">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `mgr-nav-item${isActive ? ' active' : ''}`}
            >
              <Icon size={17} />
              <span>{label}</span>
              <ChevronRight size={13} className="mgr-nav-arrow" />
            </NavLink>
          ))}
        </nav>

        <div className="mgr-sidebar-footer">
          <div className="mgr-user-info">
            <div className="mgr-user-avatar">{user?.full_name?.charAt(0) || 'C'}</div>
            <div>
              <div className="mgr-user-name">{user?.full_name}</div>
              <div className="mgr-user-role">Counsellor</div>
            </div>
          </div>
          <button className="mgr-logout-btn" onClick={handleLogout}>
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      <div className="mgr-main-wrap">
        <header className="mgr-topbar">
          <button className="mgr-menu-btn" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <span className="mgr-topbar-title">
            {navItems.find(n => location.pathname.startsWith(n.to))?.label || 'My Students'}
          </span>
          <span className="mgr-topbar-user">{user?.full_name?.split(' ')[0]}</span>
        </header>

        <main className="mgr-main counsellor-main">{children}</main>
      </div>
    </div>
  );
};
