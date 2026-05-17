import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ManagerLayout } from '../../components/manager/ManagerLayout';
import { ManagerDashboard } from './Dashboard';

// Dashboard stays eager — it's the default. Reports pulls in recharts; the rest
// are infrequent enough to defer.
const StudentsPage = lazy(() => import('./Students').then((m) => ({ default: m.StudentsPage })));
const CounsellorPage = lazy(() => import('./Counsellors').then((m) => ({ default: m.CounsellorPage })));
const InterventionsPage = lazy(() =>
  import('./Interventions').then((m) => ({ default: m.InterventionsPage })),
);
const ReportsPage = lazy(() => import('./Reports').then((m) => ({ default: m.ReportsPage })));

const PageFallback: React.FC = () => (
  <div className="flex items-center justify-center py-16">
    <div className="w-8 h-8 rounded-full border-2 border-primary-container border-t-transparent animate-spin" />
  </div>
);

export const ManagerPortalRouter: React.FC = () => {
  return (
    <ManagerLayout>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="dashboard" element={<ManagerDashboard />} />
          <Route path="students" element={<StudentsPage />} />
          <Route path="counsellors" element={<CounsellorPage />} />
          <Route path="interventions" element={<InterventionsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </Suspense>
    </ManagerLayout>
  );
};
