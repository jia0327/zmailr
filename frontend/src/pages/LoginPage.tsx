import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeSwitcher from '../components/ThemeSwitcher';
import TurnstileWidget from '../components/TurnstileWidget';
import { getRegistrationConfig } from '../config';

import { PRODUCT_FEATURES } from '../constants/productFeatures';

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean | null>(null);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);
  const [turnstileRequired, setTurnstileRequired] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');

  useEffect(() => {
    getRegistrationConfig().then((cfg) => {
      setRegistrationEnabled(cfg.enabled);
      setTurnstileRequired(cfg.turnstile.enabled);
      setTurnstileSiteKey(cfg.turnstile.siteKey);
    });
  }, []);

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/dashboard/usage" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (turnstileRequired && !turnstileToken) {
      setError(t('auth.turnstileRequired'));
      return;
    }
    setLoading(true);
    const result = await login(username, password, turnstileRequired ? turnstileToken : undefined);
    setLoading(false);
    if (result.success) {
      navigate('/dashboard/usage');
    } else {
      setError(result.error || t('auth.loginFailed'));
    }
  };

  return (
    <div className="login-shell relative min-h-screen flex flex-col">
      <div className="absolute top-4 right-4 z-10">
        <ThemeSwitcher />
      </div>

      <div className="relative flex-1 flex items-center justify-center px-4 py-6 lg:p-6">
        <div className="w-full max-w-md lg:max-w-4xl flex flex-col lg:flex-row rounded-2xl border border-sky-200/70 dark:border-border bg-card shadow-xl shadow-sky-500/10 dark:shadow-black/20 overflow-hidden">
          <div className="login-hero relative hidden lg:flex lg:flex-col lg:w-[44%] p-8 lg:p-10 min-h-0">
            <div className="shrink-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                {t('landing.badge')}
              </p>
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight mt-3 leading-tight">
                {t('landing.heroTitle')}
                <span className="text-sky-600 dark:text-sky-400"> {t('landing.heroTitleHighlight')}</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{t('landing.heroSubtitle')}</p>
            </div>

            <ul className="mt-6 space-y-3 flex-1 overflow-y-auto min-h-0 pr-1">
              {PRODUCT_FEATURES.map(({ icon, titleKey, descKey }) => (
                <li key={titleKey} className="flex items-start gap-3">
                  <span className="w-8 h-8 rounded-lg bg-sky-500/15 flex items-center justify-center shrink-0 mt-0.5">
                    <i className={`${icon} text-sm text-sky-600 dark:text-sky-400`} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug">{t(titleKey)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{t(descKey)}</p>
                  </div>
                </li>
              ))}
            </ul>

            <Link
              to="/"
              className="mt-4 shrink-0 inline-flex items-center gap-1 text-sm text-sky-600 dark:text-sky-400 hover:underline"
            >
              {t('auth.backHome')}
              <i className="fas fa-arrow-left text-xs" />
            </Link>
          </div>

          <div className="flex-1 p-6 sm:p-8 lg:p-10 flex flex-col justify-center lg:border-l border-border">
            <div className="mb-6 sm:mb-8">
              <div className="flex items-center gap-2 mb-6">
                <span className="w-8 h-8 rounded-lg bg-sky-500/15 flex items-center justify-center">
                  <i className="fas fa-envelope text-sm text-sky-600 dark:text-sky-400" />
                </span>
                <span className="font-semibold">{t('app.title')}</span>
              </div>
              <h2 className="text-xl font-bold">{t('auth.login')}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t('auth.username')} / {t('auth.password')}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <p className="text-destructive text-sm rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
                  {error}
                </p>
              )}
              <div>
                <label className="block text-sm font-medium mb-1.5">{t('auth.username')}</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="guest"
                  className="w-full px-3 py-2.5 min-h-10 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium">{t('auth.password')}</label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    {t('auth.forgotPassword')}
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="guest"
                    className="w-full px-3 py-2.5 min-h-10 pr-10 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground rounded-md"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`} />
                  </button>
                </div>
              </div>
              {turnstileRequired && turnstileSiteKey && (
                <TurnstileWidget siteKey={turnstileSiteKey} onTokenChange={setTurnstileToken} />
              )}
              <button
                type="submit"
                disabled={loading || (turnstileRequired && !turnstileToken)}
                className="w-full py-2.5 min-h-10 rounded-lg font-medium text-white bg-sky-600 hover:bg-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400 disabled:opacity-50 shadow-md shadow-sky-600/20 transition-colors"
              >
                {loading ? t('common.loading') : t('auth.login')}
              </button>
            </form>

            {registrationEnabled !== null && (
              <p className="text-sm text-muted-foreground mt-6 text-center">
                {t('auth.registerNoAccount')}{' '}
                {registrationEnabled ? (
                  <Link to="/register" className="text-sky-600 dark:text-sky-400 hover:underline font-medium">
                    {t('auth.register')}
                  </Link>
                ) : (
                  <span className="text-muted-foreground/80">{t('auth.registerDisabledByAdmin')}</span>
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
