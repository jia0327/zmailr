import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DashboardPageHeader from '../components/DashboardPageHeader';
import StatCard from '../components/StatCard';
import { useAuth } from '../contexts/AuthContext';
import { MailboxContext } from '../contexts/MailboxContext';
import { getStoredToken, migrateLegacySessionTokens } from '../utils/apiTokenSession';

const SCOPE_I18N: Record<string, string> = {
  lease: 'tokens.scopeLease',
  mail: 'tokens.scopeMail',
  send: 'tokens.scopeSend',
};

const fmtTime = (ts: number) => new Date(ts > 1e12 ? ts : ts * 1000).toLocaleString();

const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

const UsagePage: React.FC = () => {
  const { t } = useTranslation();
  const { user, usage, stats, refresh } = useAuth();
  const { showSuccessMessage, showErrorMessage } = useContext(MailboxContext);
  const [copied, setCopied] = useState(false);
  const [storedTokenPlaintext, setStoredTokenPlaintext] = useState<string | null>(null);

  const quota = user?.dailySendQuota ?? 0;
  const sendCount = usage?.sendCount ?? 0;
  const leaseCount = usage?.leaseCount ?? 0;
  const remaining = usage?.sendRemaining ?? user?.sendRemaining;

  const quotaLabel = quota < 0 ? t('auth.unlimited') : String(quota);
  const remainingLabel = remaining === undefined
    ? '—'
    : remaining < 0
      ? t('auth.unlimited')
      : String(remaining);

  const token = stats?.token ?? null;

  useEffect(() => {
    if (!user?.id || !token?.id) {
      setStoredTokenPlaintext(null);
      return;
    }
    migrateLegacySessionTokens(user.id, [token.id]);
    setStoredTokenPlaintext(getStoredToken(user.id, token.id));
  }, [user?.id, token?.id]);

  const copyToken = (plaintext: string) => {
    navigator.clipboard
      .writeText(plaintext)
      .then(() => {
        setCopied(true);
        showSuccessMessage(t('tokens.tokenCopySuccess'));
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => showErrorMessage(t('mailbox.copyFailed')));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <DashboardPageHeader
        breadcrumb={t('dashboard.breadcrumbUsage')}
        title={t('dashboard.usageTitle')}
        subtitle={t('dashboard.usageSubtitle')}
        action={
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border bg-card hover:bg-muted"
          >
            <i className="fas fa-sync-alt" />
            {t('common.refresh')}
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label={t('auth.dailyQuota')}
          value={quotaLabel}
          icon="fas fa-paper-plane"
          hint={`${t('dashboard.usedToday')}: ${sendCount}`}
        />
        <StatCard
          label={t('dashboard.statRemaining')}
          value={remainingLabel}
          icon="fas fa-hourglass-half"
        />
        <StatCard
          label={t('dashboard.leaseCount')}
          value={leaseCount}
          icon="fas fa-envelope-open"
          hint={t('dashboard.leaseCountHint')}
        />
        <StatCard
          label={t('dashboard.messagesReceived')}
          value={stats?.messagesReceivedCount ?? 0}
          icon="fas fa-inbox"
          hint={t('dashboard.messagesReceivedHint')}
        />
        <StatCard
          label={t('dashboard.customRulesCount')}
          value={stats?.customRulesCount ?? 0}
          icon="fas fa-filter"
          hint={t('dashboard.customRulesCountHint')}
        />
        <StatCard
          label={t('dashboard.usedToday')}
          value={sendCount}
          icon="fas fa-chart-line"
          hint={t('dashboard.usedTodayHint')}
        />
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold">{t('auth.profile')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label={t('auth.username')}
            value={user?.username ?? '—'}
            icon="fas fa-user"
          />
          <StatCard
            label={t('auth.role')}
            value={user?.role ?? '—'}
            icon="fas fa-user-tag"
          />
          <StatCard
            label={t('dashboard.usageDate')}
            value={usage?.usageDate ?? '—'}
            icon="fas fa-calendar-day"
          />
        </div>
      </div>

      <div className="border rounded-lg p-4 bg-card space-y-3">
        <h2 className="font-semibold">{t('dashboard.tokenInfo')}</h2>
        {token ? (
          <>
            <div className="text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">{t('tokens.nameLabel')}:</span>{' '}
                <span className="font-medium">{token.name || `#${token.id}`}</span>
              </p>
              <p>
                <span className="text-muted-foreground">{t('tokens.permissionsLabel')}:</span>{' '}
                {token.scopes
                  .map((s) => (SCOPE_I18N[s] ? t(SCOPE_I18N[s]) : s))
                  .join(', ')}
              </p>
              <p>
                <span className="text-muted-foreground">{t('tokens.expiresAtLabel')}:</span>{' '}
                {fmtTime(token.expiresAt)}
              </p>
            </div>
            {storedTokenPlaintext ? (
              <button
                type="button"
                onClick={() => copyToken(storedTokenPlaintext)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                title={t('tokens.copyOneClick')}
              >
                <CopyIcon />
                {copied ? t('common.copied') : t('tokens.copyOneClick')}
              </button>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">{t('tokens.copyUnavailable')}</p>
                <Link to="/dashboard/api-keys" className="text-xs text-primary hover:underline">
                  {t('tokens.recreateToCopy')} → {t('dashboard.apiKeys')}
                </Link>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('dashboard.noToken')}{' '}
            <Link to="/dashboard/api-keys" className="text-primary hover:underline">
              {t('dashboard.apiKeys')}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
};

export default UsagePage;
