import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import ThemeSwitcher from '../components/ThemeSwitcher';
import TurnstileWidget from '../components/TurnstileWidget';
import { getRegistrationConfig, type RegistrationDomainGroup } from '../config';
import {
  authPasswordResetResend,
  authPasswordResetSendCode,
  authPasswordResetVerify,
} from '../utils/api';

type Step = 'credentials' | 'verify';

const domainSelectClass =
  'appearance-none bg-transparent border-none focus:outline-none text-foreground font-mono text-sm';

const ForgotPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading, refresh } = useAuth();
  const navigate = useNavigate();

  const [domainGroups, setDomainGroups] = useState<RegistrationDomainGroup[]>([]);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);
  const [turnstileRequired, setTurnstileRequired] = useState(false);
  const [step, setStep] = useState<Step>('credentials');
  const [emailPrefix, setEmailPrefix] = useState('');
  const [emailDomain, setEmailDomain] = useState('qq.com');
  const [fullEmail, setFullEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [deliveryHint, setDeliveryHint] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [resendTurnstileToken, setResendTurnstileToken] = useState('');

  useEffect(() => {
    getRegistrationConfig().then((cfg) => {
      setDomainGroups(cfg.domainGroups);
      setTurnstileRequired(cfg.turnstile.enabled);
      setTurnstileSiteKey(cfg.turnstile.siteKey);
      const defaultDomain =
        cfg.allowedDomains.find((d) => d === 'qq.com') ?? cfg.allowedDomains[0] ?? 'qq.com';
      setEmailDomain(defaultDomain);
    });
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/dashboard/usage" replace />;
  }

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!emailPrefix.trim()) {
      setError(t('auth.registerPrefixRequired'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.registerPasswordMismatch'));
      return;
    }
    if (turnstileRequired && !turnstileToken) {
      setError(t('auth.turnstileRequired'));
      return;
    }
    setLoading(true);
    const result = await authPasswordResetSendCode({
      localPart: emailPrefix.trim(),
      domain: emailDomain,
      password,
      turnstileToken: turnstileRequired ? turnstileToken : undefined,
    });
    setLoading(false);
    if (result.success) {
      setFullEmail(result.email);
      setDeliveryHint(result.deliveryHint || t('auth.registerDeliveryHint'));
      setStep('verify');
      setResendCooldown(60);
      return;
    }
    setError(result.error || t('auth.forgotPasswordSendFailed'));
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await authPasswordResetVerify(fullEmail, code.trim());
    setLoading(false);
    if (result.success) {
      await refresh();
      navigate('/dashboard/usage');
      return;
    }
    setError(result.error || t('auth.forgotPasswordVerifyFailed'));
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    if (turnstileRequired && !resendTurnstileToken) {
      setError(t('auth.turnstileRequired'));
      return;
    }
    setError('');
    setLoading(true);
    const result = await authPasswordResetResend(
      fullEmail,
      turnstileRequired ? resendTurnstileToken : undefined
    );
    setLoading(false);
    if (result.success) {
      setResendCooldown(60);
      if (result.deliveryHint) setDeliveryHint(result.deliveryHint);
      return;
    }
    setError(result.error || t('auth.forgotPasswordSendFailed'));
  };

  const handlePrefixChange = (value: string) => {
    setEmailPrefix(value.replace(/@.*$/, '').slice(0, 64));
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
              <i className="fas fa-key text-sm text-sky-600 dark:text-sky-400" />
            </span>
            <span className="font-semibold">{t('auth.forgotPassword')}</span>
          </div>

          <h1 className="text-xl font-bold">
            {step === 'credentials' ? t('auth.forgotPasswordTitle') : t('auth.forgotPasswordVerifyTitle')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            {step === 'credentials'
              ? t('auth.forgotPasswordHint')
              : t('auth.forgotPasswordVerifyHint', { email: fullEmail })}
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
                <div className="flex items-stretch border rounded-lg bg-background overflow-hidden focus-within:ring-2 focus-within:ring-sky-500/40">
                  <input
                    type="text"
                    value={emailPrefix}
                    onChange={(e) => handlePrefixChange(e.target.value)}
                    placeholder={t('auth.registerEmailPrefixPlaceholder')}
                    className="flex-1 min-w-0 px-3 py-2.5 min-h-10 bg-transparent font-mono focus:outline-none"
                    autoComplete="username"
                    inputMode="email"
                    required
                  />
                  <span className="flex items-center px-2 sm:px-3 border-l bg-muted/40 text-sm shrink-0">
                    @
                    <span className="relative inline-flex items-center ml-0.5">
                      <select
                        value={emailDomain}
                        onChange={(e) => setEmailDomain(e.target.value)}
                        className={`${domainSelectClass} pl-1 pr-6 max-w-[9.5rem] sm:max-w-none`}
                        disabled={loading || domainGroups.length === 0}
                      >
                        {domainGroups.map((group) => (
                          <optgroup key={group.label} label={group.label}>
                            {group.domains.map((domain) => (
                              <option key={domain} value={domain}>
                                {domain}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <i className="fas fa-chevron-down absolute right-0 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none" />
                    </span>
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">{t('auth.forgotPasswordNew')}</label>
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
              {turnstileRequired && turnstileSiteKey && (
                <TurnstileWidget siteKey={turnstileSiteKey} onTokenChange={setTurnstileToken} />
              )}
              <button
                type="submit"
                disabled={loading || (turnstileRequired && !turnstileToken)}
                className="w-full py-2.5 min-h-10 rounded-lg font-medium text-white bg-sky-600 hover:bg-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400 disabled:opacity-50 shadow-md shadow-sky-600/20 transition-colors"
              >
                {loading ? t('common.loading') : t('auth.registerSendCode')}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              {deliveryHint && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-950 dark:text-amber-100">
                  <i className="fas fa-inbox mr-2" aria-hidden />
                  {deliveryHint}
                </div>
              )}
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
              {turnstileRequired && turnstileSiteKey && (
                <TurnstileWidget siteKey={turnstileSiteKey} onTokenChange={setResendTurnstileToken} />
              )}
              <button
                type="submit"
                disabled={loading || code.length < 6}
                className="w-full py-2.5 min-h-10 rounded-lg font-medium text-white bg-sky-600 hover:bg-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400 disabled:opacity-50 shadow-md shadow-sky-600/20 transition-colors"
              >
                {loading ? t('common.loading') : t('auth.forgotPasswordSubmit')}
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
                  disabled={
                    loading ||
                    resendCooldown > 0 ||
                    (turnstileRequired && !resendTurnstileToken)
                  }
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
            <Link to="/login" className="text-sky-600 dark:text-sky-400 hover:underline font-medium">
              {t('auth.forgotPasswordBackToLogin')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
