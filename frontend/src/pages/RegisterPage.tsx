import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import ThemeSwitcher from '../components/ThemeSwitcher';
import { isRegistrationEnabled } from '../config';
import { authRegisterResend, authRegisterSendCode, authRegisterVerify } from '../utils/api';

type Step = 'credentials' | 'verify';

const RegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading, refresh } = useAuth();
  const navigate = useNavigate();

  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null);
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    isRegistrationEnabled().then(setRegistrationOpen);
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/dashboard/usage" replace />;
  }

  if (registrationOpen === false) {
    return <Navigate to="/login" replace />;
  }

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError(t('auth.registerPasswordMismatch'));
      return;
    }
    setLoading(true);
    const result = await authRegisterSendCode(email.trim(), password);
    setLoading(false);
    if (result.success) {
      setEmail(result.email);
      setStep('verify');
      setResendCooldown(60);
      return;
    }
    setError(result.error || t('auth.registerSendFailed'));
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await authRegisterVerify(email.trim(), code.trim());
    setLoading(false);
    if (result.success) {
      await refresh();
      navigate('/dashboard/usage');
      return;
    }
    setError(result.error || t('auth.registerVerifyFailed'));
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError('');
    setLoading(true);
    const result = await authRegisterResend(email.trim());
    setLoading(false);
    if (result.success) {
      setResendCooldown(60);
      return;
    }
    setError(result.error || t('auth.registerSendFailed'));
  };

  return (
    <div className="login-shell relative min-h-screen flex flex-col">
      <div className="absolute top-4 right-4 z-10">
        <ThemeSwitcher />
      </div>

      <div className="relative flex-1 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-md rounded-2xl border border-sky-200/70 dark:border-border bg-card shadow-xl shadow-sky-500/10 dark:shadow-black/20 p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-6">
            <span className="w-8 h-8 rounded-lg bg-sky-500/15 flex items-center justify-center">
              <i className="fas fa-user-plus text-sm text-sky-600 dark:text-sky-400" />
            </span>
            <span className="font-semibold">{t('auth.register')}</span>
          </div>

          <h1 className="text-xl font-bold">{step === 'credentials' ? t('auth.registerTitle') : t('auth.registerVerifyTitle')}</h1>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            {step === 'credentials' ? t('auth.registerHint') : t('auth.registerVerifyHint', { email })}
          </p>

          {error && (
            <p className="text-destructive text-sm rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 mb-4">
              {error}
            </p>
          )}

          {step === 'credentials' ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">{t('auth.registerEmail')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@qq.com"
                  className="w-full px-3 py-2.5 min-h-10 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">{t('auth.password')}</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 min-h-10 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">{t('auth.registerConfirmPassword')}</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2.5 min-h-10 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading || registrationOpen === null}
                className="w-full py-2.5 min-h-10 rounded-lg font-medium text-white bg-sky-600 hover:bg-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400 disabled:opacity-50 shadow-md shadow-sky-600/20 transition-colors"
              >
                {loading ? t('common.loading') : t('auth.registerSendCode')}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">{t('auth.registerCode')}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full px-3 py-2.5 min-h-10 border rounded-lg bg-background font-mono tracking-widest text-center text-lg focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                  autoComplete="one-time-code"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading || code.length < 6}
                className="w-full py-2.5 min-h-10 rounded-lg font-medium text-white bg-sky-600 hover:bg-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400 disabled:opacity-50 shadow-md shadow-sky-600/20 transition-colors"
              >
                {loading ? t('common.loading') : t('auth.registerSubmit')}
              </button>
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => setStep('credentials')}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {t('auth.registerBack')}
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading || resendCooldown > 0}
                  className="text-sky-600 dark:text-sky-400 hover:underline disabled:opacity-50 disabled:no-underline"
                >
                  {resendCooldown > 0
                    ? t('auth.registerResendIn', { seconds: resendCooldown })
                    : t('auth.registerResend')}
                </button>
              </div>
            </form>
          )}

          <p className="text-sm text-muted-foreground mt-6 text-center">
            {t('auth.registerHasAccount')}{' '}
            <Link to="/login" className="text-sky-600 dark:text-sky-400 hover:underline font-medium">
              {t('auth.login')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
