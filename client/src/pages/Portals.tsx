import type React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export { ManagerPortalRouter as ManagerPortal } from './manager/index';
export { CounsellorPortalRouter as CounsellorPortal } from './counsellor/index';


export const UnauthorizedPage: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div style={{ padding: 32, textAlign: 'center', color: 'var(--text)' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Access Denied</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>You don't have permission to view this page.</p>
      <button onClick={() => { logout(); navigate('/login'); }} className="btn btn-primary">
        Go back to Login
      </button>
    </div>
  );
};

// Keep old export name for backward compat
export const StudentPortal = () => null;
