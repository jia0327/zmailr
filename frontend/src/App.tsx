import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import ApiDocsPage from './pages/ApiDocsPage';
import NotFoundPage from './pages/NotFoundPage';
import InboxPage from './pages/InboxPage';
import OutboxPage from './pages/OutboxPage';
import ApiKeysPage from './pages/ApiKeysPage';
import UsagePage from './pages/UsagePage';
import ExtractRulesPage from './pages/ExtractRulesPage';
import { MailboxProvider } from './contexts/MailboxContext';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import RootRedirect from './components/RootRedirect';
import PublicLayout from './components/PublicLayout';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <MailboxProvider>
        <div className="min-h-screen bg-background">
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/account" element={<Navigate to="/dashboard/api-keys" replace />} />

            <Route element={<PublicLayout />}>
              <Route path="api-docs" element={<ApiDocsPage />} />
            </Route>

            <Route
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="dashboard" element={<Navigate to="/dashboard/usage" replace />} />
              <Route path="dashboard/inbox" element={<InboxPage />} />
              <Route path="dashboard/outbox" element={<OutboxPage />} />
              <Route path="dashboard/api-keys" element={<ApiKeysPage />} />
              <Route path="dashboard/usage" element={<UsagePage />} />
              <Route path="dashboard/extract-rules" element={<ExtractRulesPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </div>
      </MailboxProvider>
    </AuthProvider>
  );
};

export default App;
