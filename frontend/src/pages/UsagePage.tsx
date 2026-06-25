import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DashboardPageHeader from '../components/DashboardPageHeader';
import StatCard from '../components/StatCard';
import { useAuth } from '../contexts/AuthContext';
import { MailboxContext } from '../contexts/MailboxContext';
import { getStoredToken, migrateLegacySessionTokens } from '../utils/apiTokenSession';

const fmtTime = (ts: number) => new Date(ts > 1e12 ? ts : ts * 1000).toLocaleString();

const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

const SectionHeading: React.FC<{ title: string }> = ({ title }) => (
  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
);

const UsagePage: React.FC = () => {
  const { t } = useTranslation();
  const { user, usage, stats, isLoading, refresh } = useAuth();
  const hasApiToken = Boolean(stats?.token);
  const { showSuccessMessage, showErrorMessage } = useContext(MailboxContext);
  const [copied, setCopied] = useState(false);
  const [storedTokenPlaintext, setStoredTokenPlaintext] = useState<string | null>(null);

  const quota = user?.dailySendQuota ?? 0;
  const sendCount = usage?.sendCount ?? 0;
  const quotaTotalLabel = quota < 0 ? t('auth.unlimited') : String(quota);
  const outboxQuotaValue = `${sendCount} / ${quotaTotalLabel}`;

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
    <div className="max-w-4xl mx-auto space-y-8">
      <DashboardPageHeader
        breadcrumb={t('dashboard.breadcrumbUsage')}
        title={t('dashboard.usageTitle')}
        subtitle={t('dashboard.usageSubtitle')}
        action={
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-10 text-sm font-medium rounded-md border bg-card hover:bg-muted w-full sm:w-auto"
          >
            <i className="fas fa-sync-alt" />
            {t('common.refresh')}
          </button>
        }
      />

      {!isLoading && !hasApiToken && (
        <div
          className="rounded-lg border border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20 p-4 flex flex-col sm:flex-row sm:items-center gap-4"
          role="alert"
        >
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <i className="fas fa-exclamation-triangle text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                {t('dashboard.noTokenBannerTitle')}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{t('dashboard.noTokenBannerBody')}</p>
            </div>
          </div>
          <Link
            to="/dashboard/api-keys"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-10 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 w-full sm:w-auto"
          >
            <i className="fas fa-key" aria-hidden="true" />
            {t('dashboard.noTokenBannerCta')}
          </Link>
        </div>
      )}

      <section className="space-y-3">
        <SectionHeading title={t('dashboard.sectionProfile')} />
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
      </section>

      {token && (
        <section className="space-y-3">
          <SectionHeading title={t('dashboard.sectionApiToken')} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label={t('tokens.nameLabel')}
              value={token.name ?? '—'}
              icon="fas fa-tag"
            />
            <div className="rounded-lg border bg-card p-4 flex flex-col justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('tokens.copyOneClick')}
                </p>
                {storedTokenPlaintext ? null : (
                  <p className="text-sm text-muted-foreground mt-1">{t('tokens.copyUnavailable')}</p>
                )}
              </div>
              {storedTokenPlaintext ? (
                <button
                  type="button"
                  onClick={() => copyToken(storedTokenPlaintext)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto"
                  title={t('tokens.copyOneClick')}
                >
                  <CopyIcon />
                  {copied ? t('common.copied') : t('tokens.copyOneClick')}
                </button>
              ) : (
                <Link
                  to="/dashboard/api-keys"
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border hover:bg-muted w-full sm:w-auto text-center"
                >
                  {t('tokens.recreateToCopy')} →
                </Link>
              )}
            </div>
            <StatCard
              label={t('tokens.expiresAtLabel')}
              value={fmtTime(token.expiresAt)}
              icon="fas fa-clock"
            />
          </div>
        </section>
      )}

      <section className="space-y-3">
        <SectionHeading title={t('dashboard.sectionInbox')} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label={t('dashboard.randomMailbox')}
            value={stats?.mailboxesCount ?? 0}
            icon="fas fa-envelope-open"
            hint={t('dashboard.randomMailboxHint')}
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
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading title={t('dashboard.sectionOutbox')} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            label={t('dashboard.outboxQuotaUsedTotal')}
            value={outboxQuotaValue}
            icon="fas fa-paper-plane"
            hint={t('dashboard.outboxQuotaUsedTotalHint')}
          />
        </div>
      </section>
    </div>
  );
};

export default UsagePage;
