import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { CounsellorLayout } from '../../components/counsellor/CounsellorLayout';
import { CounsellorDashboard } from './Dashboard';
import { CounsellorStudentReport } from './StudentReport';
import { CounsellorProfile } from './Profile';
import { SharedFeedPage } from './SharedFeed';

export const CounsellorPortalRouter: React.FC = () => {
  return (
    <CounsellorLayout>
      <Routes>
        <Route path="dashboard" element={<CounsellorDashboard />} />
        <Route path="students/:id" element={<CounsellorStudentReport />} />
        <Route path="shared-feed" element={<SharedFeedPage />} />
        <Route path="profile" element={<CounsellorProfile />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </CounsellorLayout>
  );
};
