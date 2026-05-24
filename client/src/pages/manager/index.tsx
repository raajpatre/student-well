import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ManagerLayout } from '../../components/manager/ManagerLayout';
import { ManagerDashboard } from './Dashboard';
import { StudentsPage } from './Students';
import { CounsellorPage } from './Counsellors';
import { InterventionsPage } from './Interventions';
import { ReportsPage } from './Reports';
import { OnboardStudents } from './OnboardStudents';

export const ManagerPortalRouter: React.FC = () => {
  return (
    <ManagerLayout>
      <Routes>
        <Route path="dashboard" element={<ManagerDashboard />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="students/onboard" element={<OnboardStudents />} />
        <Route path="counsellors" element={<CounsellorPage />} />
        <Route path="interventions" element={<InterventionsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </ManagerLayout>
  );
};
