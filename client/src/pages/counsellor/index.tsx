import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { CounsellorLayout } from '../../components/counsellor/CounsellorLayout';
import { CounsellorDashboard } from './Dashboard';
import { CounsellorStudentReport } from './StudentReport';
import { CounsellorProfile } from './Profile';

export const CounsellorPortalRouter: React.FC = () => {
  return (
    <CounsellorLayout>
      <Routes>
        <Route path="dashboard" element={<CounsellorDashboard />} />
        <Route path="students/:id" element={<CounsellorStudentReport />} />
        <Route path="profile" element={<CounsellorProfile />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </CounsellorLayout>
  );
};
