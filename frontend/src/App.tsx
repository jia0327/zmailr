import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import { MailboxProvider } from './contexts/MailboxContext';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import PublicLayout from './components/PublicLayout';
import LandingPage from './pages/LandingPage';

const ApiDocsPage = lazy(() => import('./pages/ApiDocsPage'));
const InboxPage = lazy(() => import('./pages/InboxPage'));
const OutboxPage = lazy(() => import('./pages/OutboxPage'));
const ApiKeysPage = lazy(() => import('./pages/ApiKeysPage'));
const UsagePage = lazy(() => import('./pages/UsagePage'));
const ExtractRulesPage = lazy(() => import('./pages/ExtractRulesPage'));
const ApiDebugPage = lazy(() => import('./pages/ApiDebugPage'));

const RouteFallback: React.FC = () => (
  <div className="flex min-h-[50vh] items-center justify-center bg-background">
    <div className="animate-spin rounded-full h-8 w-8 border-2 border-muted-foreground/20 border-t-foreground" />
  </div>
);

/** /api-docs — full page or ?embed=1 for iframe embed in docs. */
const ApiDocsRoute: React.FC = () => <ApiDocsPage />;

const App: React.FC = () => {
  return (
    <AuthProvider>
      <MailboxProvider>
        <div className="min-h-screen bg-background">
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/account" element={<Navigate to="/dashboard/api-keys" replace />} />

              <Route element={<PublicLayout />}>
                <Route path="api-docs" element={<ApiDocsRoute />} />
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
                <Route path="dashboard/api-debug" element={<ApiDebugPage />} />
                <Route path="dashboard/usage" element={<UsagePage />} />
                <Route path="dashboard/extract-rules" element={<ExtractRulesPage />} />
                <Route path="dashboard/*" element={<Navigate to="/dashboard/usage" replace />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
      </MailboxProvider>
    </AuthProvider>
  );
};

export default App;
