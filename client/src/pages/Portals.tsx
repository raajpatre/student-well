import type React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export { ManagerPortalRouter as ManagerPortal } from './manager/index';
export { CounsellorPortalRouter as CounsellorPortal } from './counsellor/index';


export const UnauthorizedPage: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="bg-surface-container-lowest rounded-card shadow-warm p-lg text-center max-w-sm w-full">
        <div className="w-16 h-16 rounded-full bg-error-container flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-on-error-container text-[32px]">lock</span>
        </div>
        <h1 className="text-headline-md text-on-surface mb-2">Access Denied</h1>
        <p className="text-[14px] text-outline mb-6">You don't have permission to view this page.</p>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="w-full h-[48px] bg-primary-container text-on-primary rounded-btn font-body-md hover:bg-primary transition-colors shadow-sm"
        >
          Go back to Login
        </button>
      </div>
    </div>
  );
};

// Keep old export name for backward compat
export const StudentPortal = () => null;
