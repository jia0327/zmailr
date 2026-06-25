import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ComposeForm from '../components/ComposeForm';
import DashboardPageHeader from '../components/DashboardPageHeader';
import StatCard from '../components/StatCard';
import { useAuth } from '../contexts/AuthContext';
import { MailboxContext } from '../contexts/MailboxContext';
import { getUserSentEmails, SentEmailItem } from '../utils/api';
import { getDefaultEmailDomain, DEFAULT_EMAIL_DOMAIN } from '../config';

const OutboxPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, usage, refresh } = useAuth();
  const { mailbox } = useContext(MailboxContext);
  const [sentEmails, setSentEmails] = useState<SentEmailItem[]>([]);
  const [loadingSent, setLoadingSent] = useState(true);
  const [defaultDomain, setDefaultDomain] = useState(DEFAULT_EMAIL_DOMAIN);

  const loadSent = async () => {
    setLoadingSent(true);
    const result = await getUserSentEmails(50);
    if (result.success) setSentEmails(result.emails);
    setLoadingSent(false);
  };

  useEffect(() => {
    loadSent();
    getDefaultEmailDomain().then(setDefaultDomain).catch(() => {});
  }, []);

  const quota = user?.dailySendQuota ?? 0;
  const sendCount = usage?.sendCount ?? user?.sendCountToday ?? 0;
  const remaining = usage?.sendRemaining ?? user?.sendRemaining;
  const quotaDisplay = quota < 0
    ? t('auth.unlimited')
    : `${sendCount} / ${quota}`;
  const remainingDisplay = remaining === undefined
    ? '—'
    : remaining < 0
      ? t('auth.unlimited')
      : String(remaining);

  const defaultFrom = mailbox
    ? `${mailbox.address.includes('@') ? mailbox.address.split('@')[0] : mailbox.address}@${defaultDomain}`
    : undefined;

  const fmtTime = (ts: number) =>
    new Date(ts > 1e12 ? ts : ts * 1000).toLocaleString();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <DashboardPageHeader
        breadcrumb={t('dashboard.breadcrumbOutbox')}
        title={t('dashboard.outboxTitle')}
        subtitle={t('dashboard.outboxSubtitle')}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label={t('dashboard.statDailyQuota')}
          value={quotaDisplay}
          icon="fas fa-paper-plane"
        />
        <StatCard
          label={t('dashboard.statRemaining')}
          value={remainingDisplay}
          icon="fas fa-hourglass-half"
        />
        <StatCard
          label={t('dashboard.statSentTotal')}
          value={sentEmails.length}
          icon="fas fa-list"
          hint={t('dashboard.statSentHint')}
        />
      </div>

      <div className="border rounded-lg p-4 bg-card">
        <h2 className="font-semibold mb-4">{t('send.title')}</h2>
        <ComposeForm
          defaultFrom={defaultFrom}
          onSent={() => {
            refresh();
            loadSent();
          }}
        />
      </div>

      <div className="border rounded-lg overflow-hidden bg-card">
        <div className="px-4 py-3 border-b bg-muted/20 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide">{t('dashboard.sentList')}</h2>
          <button
            onClick={loadSent}
            className="p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground"
            title={t('common.refresh')}
          >
            <i className={`fas fa-sync-alt text-sm ${loadingSent ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {loadingSent ? (
          <div className="py-12 text-center text-muted-foreground text-sm">{t('common.loading')}</div>
        ) : sentEmails.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">{t('dashboard.noSentEmails')}</div>
        ) : (
          <div className="divide-y">
            {sentEmails.map((email) => (
              <div key={email.id} className="px-4 py-3 grid sm:grid-cols-[1fr_2fr_auto] gap-2 items-center text-sm">
                <span className="truncate text-muted-foreground">{email.toEmail}</span>
                <span className="truncate">{email.subject}</span>
                <div className="flex items-center gap-2 sm:justify-end">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      email.status === 'sent'
                        ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {email.status}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{fmtTime(email.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OutboxPage;
