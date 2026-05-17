import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { StudentLayout } from '../../components/student/StudentLayout';
import { DashboardPage } from './Dashboard';
import { CheckinPage } from './Checkin';

// Lazy-load the non-default surfaces. Trends pulls in recharts (~150KB),
// Chat carries the message stream, and the rest are infrequent. The default
// Dashboard + Checkin stay eager so the first-paint experience is unchanged.
const TrendsPage = lazy(() => import('./Trends').then((m) => ({ default: m.TrendsPage })));
const ChatPage = lazy(() => import('./Chat').then((m) => ({ default: m.ChatPage })));
const SpacesPage = lazy(() => import('./Spaces').then((m) => ({ default: m.SpacesPage })));
const PrivacyPage = lazy(() => import('./Privacy').then((m) => ({ default: m.PrivacyPage })));
const SettingsPage = lazy(() => import('./Settings').then((m) => ({ default: m.SettingsPage })));

const PageFallback: React.FC = () => (
  <div className="flex items-center justify-center py-16">
    <div className="w-8 h-8 rounded-full border-2 border-primary-container border-t-transparent animate-spin" />
  </div>
);

export const StudentPortalRouter: React.FC = () => {
  return (
    <StudentLayout>
      <Suspense fallback={<PageFallback />}>
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
      </Suspense>
    </StudentLayout>
  );
};
