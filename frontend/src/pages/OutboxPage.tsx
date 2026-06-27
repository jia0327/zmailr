import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ComposeForm from '../components/ComposeForm';
import DashboardPageHeader from '../components/DashboardPageHeader';
import StatCard from '../components/StatCard';
import { useAuth } from '../contexts/AuthContext';
import { MailboxContext } from '../contexts/MailboxContext';
import ListPagination, { HISTORY_PAGE_SIZE } from '../components/ListPagination';
import SentEmailDetailModal from '../components/SentEmailDetailModal';
import { getUserSentEmails, deleteUserSentEmails, SentEmailItem } from '../utils/api';
import { getDefaultEmailDomain, DEFAULT_EMAIL_DOMAIN, formatMailboxEmail } from '../config';

const OutboxPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, usage, refresh } = useAuth();
  const { mailbox } = useContext(MailboxContext);
  const [sentEmails, setSentEmails] = useState<SentEmailItem[]>([]);
  const [sentTotal, setSentTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loadingSent, setLoadingSent] = useState(true);
  const [defaultDomain, setDefaultDomain] = useState(DEFAULT_EMAIL_DOMAIN);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const totalPages = Math.max(1, Math.ceil(sentTotal / HISTORY_PAGE_SIZE));

  const loadSent = async (pageNum = page, searchTerm = search) => {
    setLoadingSent(true);
    const result = await getUserSentEmails({
      page: pageNum,
      limit: HISTORY_PAGE_SIZE,
      search: searchTerm || undefined,
    });
    if (result.success) {
      setSentEmails(result.emails);
      setSentTotal(result.total);
      setPage(result.page);
    }
    setLoadingSent(false);
    setSelectedIds(new Set());
  };

  useEffect(() => {
    getDefaultEmailDomain().then(setDefaultDomain).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    loadSent(page, search);
  }, [page, search]);

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
    ? formatMailboxEmail(mailbox, defaultDomain)
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

  const pageIds = sentEmails.map((e) => e.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(t('history.confirmDeleteSent', { count: selectedIds.size }))) return;
    setBulkBusy(true);
    const result = await deleteUserSentEmails({ ids: Array.from(selectedIds) });
    if (result.success) {
      await loadSent(page, search);
    }
    setBulkBusy(false);
  };

  const handleDeleteAll = async () => {
    if (sentTotal === 0) return;
    if (!confirm(t('history.confirmClearAllSent'))) return;
    setBulkBusy(true);
    const result = await deleteUserSentEmails({ all: true });
    if (result.success) {
      setSentEmails([]);
      setSentTotal(0);
      setSelectedIds(new Set());
      setPage(1);
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
          value={sentTotal}
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
            loadSent(1, search);
          }}
        />
      </div>

      <div className="border rounded-lg overflow-hidden bg-card">
        <div className="px-4 py-3 border-b bg-muted/20 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide">{t('dashboard.sentList')}</h2>
          <div className="flex items-center gap-1">
            {sentTotal > 0 && (
              <>
                <button
                  onClick={handleDeleteSelected}
                  disabled={bulkBusy || selectedIds.size === 0}
                  className="px-3 py-2 min-h-10 text-xs rounded-md hover:bg-muted transition-colors text-muted-foreground disabled:opacity-40"
                >
                  {t('history.deleteSelected')}
                </button>
                <button
                  onClick={handleDeleteAll}
                  disabled={bulkBusy}
                  className="px-3 py-2 min-h-10 text-xs rounded-md hover:bg-muted transition-colors text-muted-foreground"
                >
                  {t('history.clearAll')}
                </button>
              </>
            )}
            <button
              onClick={() => loadSent(page, search)}
              disabled={bulkBusy}
              className="p-2 min-w-10 min-h-10 rounded-md hover:bg-muted transition-colors text-muted-foreground"
              title={t('common.refresh')}
            >
              <i className={`fas fa-sync-alt text-sm ${loadingSent ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        <div className="px-4 py-2 border-b bg-muted/5">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('history.searchSent')}
            className="w-full px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label={t('history.searchSent')}
          />
        </div>
        {loadingSent || bulkBusy ? (
          <div className="py-12 text-center text-muted-foreground text-sm">{t('common.loading')}</div>
        ) : sentEmails.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            {search ? t('history.noSearchResults') : t('dashboard.noSentEmails')}
          </div>
        ) : (
          <>
            <div className="hidden sm:grid grid-cols-[auto_1fr_2fr_auto] gap-2 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b bg-muted/10 items-center">
              <input
                type="checkbox"
                checked={allPageSelected}
                onChange={toggleSelectAll}
                className="rounded"
              />
              <span>{t('email.to')}</span>
              <span>{t('email.subject')}</span>
              <span className="text-right">{t('email.date')}</span>
            </div>
            <div className="divide-y">
              {sentEmails.map((email) => (
                <div
                  key={email.id}
                  className="px-4 py-3 grid sm:grid-cols-[auto_1fr_2fr_auto] gap-2 items-center text-sm cursor-pointer hover:bg-muted/30"
                  onClick={() => setDetailId(email.id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(email.id)}
                    onChange={() => toggleSelect(email.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded"
                  />
                  <span className="truncate text-muted-foreground">{email.toEmail}</span>
                  <span className="truncate">{email.subject}</span>
                  <div className="flex items-center gap-2 sm:justify-end">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        email.status === 'sent'
                          ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                          : 'bg-destructive/10 text-destructive'
                      }`}
                    >
                      {email.status}
                    </span>
                    {(email.attachmentCount ?? 0) > 0 && (
                      <i className="fas fa-paperclip text-xs text-muted-foreground" title={t('send.attachments')} />
                    )}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{fmtTime(email.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
            <ListPagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              disabled={bulkBusy || loadingSent}
            />
          </>
        )}
      </div>

      {detailId != null && (
        <SentEmailDetailModal
          emailId={detailId}
          onClose={() => setDetailId(null)}
          onResent={() => {
            refresh();
            loadSent(page, search);
          }}
        />
      )}
    </div>
  );
};

export default OutboxPage;
