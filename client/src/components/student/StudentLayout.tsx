import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { to: '/student/dashboard', icon: 'home', label: 'Home' },
  { to: '/student/trends', icon: 'trending_up', label: 'Trends' },
  { to: '/student/chat', icon: 'chat_bubble', label: 'Chat' },
  { to: '/student/settings', icon: 'settings', label: 'Settings' },
];

export const StudentLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const firstName = user?.full_name?.split(' ')[0] || 'Student';
  const initial = (user?.full_name?.[0] || 'S').toUpperCase();

  return (
    <div className="min-h-screen bg-surface font-body-md text-on-surface antialiased relative pb-24">
      {/* Header */}
      <header className="glass-header sticky top-0 z-40 px-container-padding py-md flex items-center justify-between shadow-[0_1px_0_rgba(232,226,217,0.5)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-medium shadow-warm text-[16px]">
            {initial}
          </div>
          <div className="flex flex-col">
            <span className="text-[15px] font-medium text-on-surface leading-tight">{firstName}</span>
            <span className="text-[11px] text-on-surface-variant mt-0.5">Student</span>
          </div>
        </div>
        {/* Notifications — non-interactive placeholder until notification system is built */}
        <div
          className="w-10 h-10 rounded-full bg-surface-container-lowest flex items-center justify-center shadow-warm"
          title="Notifications"
        >
          <span className="material-symbols-outlined text-[20px] text-outline">notifications</span>
        </div>
      </header>

      {/* Main content */}
      <main className="px-container-padding pt-md flex flex-col gap-xl max-w-lg mx-auto">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-6 pt-2 rounded-t-2xl glass-bottom shadow-[0_-4px_16px_rgba(44,36,23,0.04)] md:hidden">
        {navItems.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              isActive
                ? 'bg-primary-container text-on-primary-container rounded-xl px-5 py-2 w-[72px] flex flex-col items-center justify-center'
                : 'text-on-surface-variant p-2 w-[72px] flex flex-col items-center justify-center hover:bg-surface-container-low rounded-xl transition-colors'
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className="material-symbols-outlined"
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {icon}
                </span>
                <span className="font-label-caps text-[11px] mt-1">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};
