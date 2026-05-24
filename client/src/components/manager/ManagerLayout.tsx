import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { to: '/manager/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { to: '/manager/students', icon: 'group', label: 'Students' },
  { to: '/manager/students/onboard', icon: 'person_add', label: 'Onboard Students' },
  { to: '/manager/counsellors', icon: 'support_agent', label: 'Counsellors' },
  { to: '/manager/interventions', icon: 'flag', label: 'Interventions' },
  { to: '/manager/reports', icon: 'bar_chart', label: 'Reports' },
];

export const ManagerLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex h-screen overflow-hidden bg-background text-on-surface">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-inverse-surface/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-30 flex flex-col w-[240px] flex-shrink-0
          bg-surface-container-low border-r border-custom-divider h-full
          transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="px-md pt-lg pb-xl flex items-center gap-xs">
          <span
            className="material-symbols-outlined text-primary-container"
            style={{ fontSize: '26px', fontVariationSettings: "'FILL' 1" }}
          >
            eco
          </span>
          <span className="text-[22px] font-light tracking-tight text-primary-container">StudentWell</span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-[4px] px-md flex-1">
          {navItems.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-md px-3 py-2.5 rounded-lg transition-colors text-[14px] font-medium ${
                  isActive
                    ? 'bg-surface-container text-on-surface'
                    : 'text-outline hover:bg-surface-container'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: '20px',
                      ...(isActive ? { fontVariationSettings: "'FILL' 1" } : {}),
                    }}
                  >
                    {icon}
                  </span>
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="mt-auto px-md pb-lg pt-md border-t border-custom-divider flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant text-[13px] font-semibold flex-shrink-0">
              {user?.full_name?.charAt(0) || 'M'}
            </div>
            <div>
              <div className="text-[13px] font-medium text-on-surface leading-tight">{user?.full_name || 'Manager'}</div>
              <div className="text-[11px] text-outline leading-tight">Manager Portal</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
            title="Sign out"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>logout</span>
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-md py-3 border-b border-custom-divider bg-surface-container-low flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-outline hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>menu</span>
          </button>
          <span className="text-[16px] font-medium text-on-surface">StudentWell</span>
          <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-[12px] font-semibold text-on-surface-variant">
            {user?.full_name?.charAt(0) || 'M'}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  );
};
