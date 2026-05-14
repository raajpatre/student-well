import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { StudentPortalRouter } from './pages/student/index';
import { CounsellorPortal, ManagerPortal, UnauthorizedPage } from './pages/Portals';
import './index.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
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
      </Router>
    </AuthProvider>
  );
}

export default App;
