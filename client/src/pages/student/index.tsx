import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { StudentLayout } from '../../components/student/StudentLayout';
import { DashboardPage } from './Dashboard';
import { CheckinPage } from './Checkin';
import { TrendsPage } from './Trends';
import { ChatPage } from './Chat';
import { SpacesPage } from './Spaces';
import { PrivacyPage } from './Privacy';
import { SettingsPage } from './Settings';

export const StudentPortalRouter: React.FC = () => {
  return (
    <StudentLayout>
      <Routes>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="checkin" element={<CheckinPage />} />
        <Route path="trends" element={<TrendsPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="spaces" element={<SpacesPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Routes>
    </StudentLayout>
  );
};
