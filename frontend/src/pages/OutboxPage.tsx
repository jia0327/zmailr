import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ComposeForm from '../components/ComposeForm';
import DashboardPageHeader from '../components/DashboardPageHeader';
import StatCard from '../components/StatCard';
import { useAuth } from '../contexts/AuthContext';
import { MailboxContext } from '../contexts/MailboxContext';
import { getUserSentEmails, deleteUserSentEmails, SentEmailItem } from '../utils/api';
import { getDefaultEmailDomain, DEFAULT_EMAIL_DOMAIN } from '../config';

const OutboxPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, usage, refresh } = useAuth();
  const { mailbox } = useContext(MailboxContext);
  const [sentEmails, setSentEmails] = useState<SentEmailItem[]>([]);
  const [loadingSent, setLoadingSent] = useState(true);
  const [defaultDomain, setDefaultDomain] = useState(DEFAULT_EMAIL_DOMAIN);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const loadSent = async () => {
    setLoadingSent(true);
    const result = await getUserSentEmails(50);
    if (result.success) setSentEmails(result.emails);
    setLoadingSent(false);
    setSelectedIds(new Set());
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

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === sentEmails.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sentEmails.map((e) => e.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(t('history.confirmDeleteSent', { count: selectedIds.size }))) return;
    setBulkBusy(true);
    const result = await deleteUserSentEmails({ ids: Array.from(selectedIds) });
    if (result.success) {
      setSentEmails(sentEmails.filter((e) => !selectedIds.has(e.id)));
      setSelectedIds(new Set());
    }
    setBulkBusy(false);
  };

  const handleDeleteAll = async () => {
    if (sentEmails.length === 0) return;
    if (!confirm(t('history.confirmClearAllSent'))) return;
    setBulkBusy(true);
    const result = await deleteUserSentEmails({ all: true });
    if (result.success) {
      setSentEmails([]);
      setSelectedIds(new Set());
    }
    setBulkBusy(false);
  };

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
        <div className="px-4 py-3 border-b bg-muted/20 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide">{t('dashboard.sentList')}</h2>
          <div className="flex items-center gap-1">
            {sentEmails.length > 0 && (
              <>
                <button
                  onClick={handleDeleteSelected}
                  disabled={bulkBusy || selectedIds.size === 0}
                  className="px-2 py-1 text-xs rounded-md hover:bg-muted transition-colors text-muted-foreground disabled:opacity-40"
                >
                  {t('history.deleteSelected')}
                </button>
                <button
                  onClick={handleDeleteAll}
                  disabled={bulkBusy}
                  className="px-2 py-1 text-xs rounded-md hover:bg-muted transition-colors text-muted-foreground"
                >
                  {t('history.clearAll')}
                </button>
              </>
            )}
            <button
              onClick={loadSent}
              disabled={bulkBusy}
              className="p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground"
              title={t('common.refresh')}
            >
              <i className={`fas fa-sync-alt text-sm ${loadingSent ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        {loadingSent || bulkBusy ? (
          <div className="py-12 text-center text-muted-foreground text-sm">{t('common.loading')}</div>
        ) : sentEmails.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">{t('dashboard.noSentEmails')}</div>
        ) : (
          <>
            <div className="hidden sm:grid grid-cols-[auto_1fr_2fr_auto] gap-2 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b bg-muted/10 items-center">
              <input
                type="checkbox"
                checked={selectedIds.size === sentEmails.length && sentEmails.length > 0}
                onChange={toggleSelectAll}
                className="rounded"
              />
              <span>{t('email.to')}</span>
              <span>{t('email.subject')}</span>
              <span className="text-right">{t('email.date')}</span>
            </div>
            <div className="divide-y">
              {sentEmails.map((email) => (
                <div key={email.id} className="px-4 py-3 grid sm:grid-cols-[auto_1fr_2fr_auto] gap-2 items-center text-sm">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(email.id)}
                    onChange={() => toggleSelect(email.id)}
                    className="rounded"
                  />
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
          </>
        )}
      </div>
    </div>
  );
};

export default OutboxPage;
