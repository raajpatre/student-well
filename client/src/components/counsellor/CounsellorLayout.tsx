import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { to: '/counsellor/dashboard', iconInactive: 'home', iconActive: 'home', label: 'Home' },
  { to: '/counsellor/profile', iconInactive: 'person', iconActive: 'person', label: 'My Profile' },
];

export const CounsellorLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'C';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Sticky glass top bar */}
      <header className="w-full sticky top-0 z-40 bg-surface/80 backdrop-blur-md border-b border-outline-variant/30 transition-all duration-300">
        <div className="flex items-center justify-between px-gutter py-md w-full max-w-2xl mx-auto">
          {/* WordMark */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center">
              <span
                className="material-symbols-outlined text-on-primary-container"
                style={{ fontSize: '18px', fontVariationSettings: "'FILL' 1" }}
              >
                eco
              </span>
            </div>
            <span className="font-display text-[20px] font-light text-primary leading-none">StudentWell</span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <button
              aria-label="Notifications"
              className="p-2 text-primary hover:opacity-80 transition-opacity rounded-full hover:bg-surface-container-low"
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: '22px', fontVariationSettings: "'FILL' 0" }}
              >
                notifications
              </span>
            </button>
            {/* Counsellor avatar with logout */}
            <button
              onClick={handleLogout}
              className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center border-2 border-surface-container-highest hover:opacity-80 transition-opacity"
              aria-label="Sign out"
            >
              <span className="text-on-primary-container font-body-sm text-[13px] font-medium">{initials}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Scrollable main content */}
      <main className="flex-1 pb-24">
        {children}
      </main>

      {/* Glass bottom nav */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-6 pt-2 bg-surface-container-lowest/90 backdrop-blur-md shadow-warm rounded-t-xl transition-all duration-200">
        {navItems.map(({ to, iconInactive, iconActive, label }) => (
          <NavLink
            key={to}
            to={to}
            className="flex flex-col items-center justify-center"
          >
            {({ isActive }) => (
              <div
                className={`flex flex-col items-center justify-center rounded-xl px-4 py-2 transition-colors active:scale-95 ${
                  isActive
                    ? 'bg-primary-container text-on-primary-container'
                    : 'text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                <span
                  className="material-symbols-outlined mb-1"
                  style={{
                    fontSize: '22px',
                    fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                  }}
                >
                  {isActive ? iconActive : iconInactive}
                </span>
                <span className="font-label-caps text-label-caps">{label}</span>
              </div>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};
