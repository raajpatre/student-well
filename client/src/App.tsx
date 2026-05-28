import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { UnauthorizedPage } from './pages/UnauthorizedPage';
import './index.css';

// Each role portal becomes its own chunk so students don't download manager
// code, managers don't download student check-in code, and the heavy chart
// libraries only load on the routes that use them.
const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const StudentPortalRouter = lazy(() =>
  import('./pages/student/index').then((m) => ({ default: m.StudentPortalRouter })),
);
const ManagerPortal = lazy(() =>
  import('./pages/Portals').then((m) => ({ default: m.ManagerPortal })),
);
const CounsellorPortal = lazy(() =>
  import('./pages/Portals').then((m) => ({ default: m.CounsellorPortal })),
);
const ActivatePage = lazy(() =>
  import('./pages/ActivatePage').then((m) => ({ default: m.ActivatePage })),
);
const ResetPasswordPage = lazy(() =>
  import('./pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })),
);

const RouteFallback: React.FC = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-10 h-10 rounded-full border-2 border-primary-container border-t-transparent animate-spin" />
  </div>
);

function App() {
  return (
    <AuthProvider>
      <Router>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/activate" element={<ActivatePage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            <Route
              path="/student/*"
              element={
                <ProtectedRoute requiredRole="student">
                  <StudentPortalRouter />
                </ProtectedRoute>
              }
            />
            <Route
              path="/counsellor/*"
              element={
                <ProtectedRoute requiredRole="counsellor">
                  <CounsellorPortal />
                </ProtectedRoute>
              }
            />
            <Route
              path="/manager/*"
              element={
                <ProtectedRoute requiredRole="manager">
                  <ManagerPortal />
                </ProtectedRoute>
              }
            />

            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}

export default App;
