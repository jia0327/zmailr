import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import Container from '../components/Container';
import { useAuth } from '../contexts/AuthContext';

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/account" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(username, password);
    setLoading(false);
    if (result.success) {
      navigate('/account');
    } else {
      setError(result.error || t('auth.loginFailed'));
    }
  };

  return (
    <Container>
      <div className="max-w-md mx-auto mt-12">
        <h1 className="text-2xl font-bold mb-6 text-center">{t('auth.loginTitle')}</h1>
        <form onSubmit={handleSubmit} className="space-y-4 border rounded-lg p-6 bg-card">
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div>
            <label className="block text-sm font-medium mb-1">{t('auth.username')}</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('auth.password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background"
              autoComplete="current-password"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? t('common.loading') : t('auth.login')}
          </button>
        </form>
        <p className="text-center text-sm text-muted-foreground mt-4">
          <Link to="/" className="text-primary hover:underline">{t('auth.backHome')}</Link>
        </p>
      </div>
    </Container>
  );
};

export default LoginPage;
