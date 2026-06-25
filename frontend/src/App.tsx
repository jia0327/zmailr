import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ApiDocsPage from './pages/ApiDocsPage';
import LoginPage from './pages/LoginPage';
import AccountPage from './pages/AccountPage';
import NotFoundPage from './pages/NotFoundPage';
import { MailboxProvider } from './contexts/MailboxContext';
import { AuthProvider } from './contexts/AuthContext';

const App: React.FC = () => {

  return (
      <AuthProvider>
        <MailboxProvider>
          <div className="min-h-screen bg-background">
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<HomePage />} />
                <Route path="api-docs" element={<ApiDocsPage />} />
                <Route path="login" element={<LoginPage />} />
                <Route path="account" element={<AccountPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </div>
        </MailboxProvider>
      </AuthProvider>
  );
};

export default App;
