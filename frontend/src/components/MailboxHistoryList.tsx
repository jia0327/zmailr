import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getUserMailboxes,
  deleteMailbox as apiDeleteMailbox,
  UserMailboxItem,
} from '../utils/api';
import { formatMailboxTimeLeft } from '../utils/mailboxTime';
import ListPagination, { HISTORY_PAGE_SIZE } from './ListPagination';
import OtpBox from './OtpBox';
import {
  formatMailboxDisplayEmail,
  getMailboxLocalPart,
  isSameMailbox,
  mailboxIdentityKey,
} from '../utils/mailbox';

interface MailboxHistoryListProps {
  activeMailbox?: Mailbox | null;
  onSelect: (mailbox: UserMailboxItem) => void;
  onDeleted?: (mailbox: UserMailboxItem) => void;
}

const MailboxHistoryList: React.FC<MailboxHistoryListProps> = ({
  activeMailbox,
  onSelect,
  onDeleted,
}) => {
  const { t } = useTranslation();
  const [mailboxes, setMailboxes] = useState<UserMailboxItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));

  const load = async (pageNum = page, searchTerm = search) => {
    setLoading(true);
    const result = await getUserMailboxes({
      hasEmails: true,
      withLatestEmail: true,
      orderBy: 'latestEmail',
      page: pageNum,
      limit: HISTORY_PAGE_SIZE,
      search: searchTerm || undefined,
    });
    if (result.success) {
      setMailboxes(result.mailboxes);
      setTotal(result.total);
      setPage(result.page);
    }
    setLoading(false);
    setSelected(new Set());
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    load(page, search);
  }, [page, search]);

  const toggleSelect = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const pageKeys = mailboxes.map((m) => mailboxIdentityKey(m));
  const allPageSelected =
    pageKeys.length > 0 && pageKeys.every((key) => selected.has(key));

  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        pageKeys.forEach((key) => next.delete(key));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        pageKeys.forEach((key) => next.add(key));
        return next;
      });
    }
  };

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(t('history.confirmDeleteMailboxes', { count: selected.size }))) return;
    setBusy(true);
    for (const mb of mailboxes) {
      const key = mailboxIdentityKey(mb);
      if (!selected.has(key)) continue;
      await apiDeleteMailbox(getMailboxLocalPart(mb.address));
      onDeleted?.(mb);
    }
    await load(page, search);
    setBusy(false);
  };

  const handleDeleteOne = async (mb: UserMailboxItem) => {
    if (!confirm(t('mailbox.confirmDeleteMailbox'))) return;
    setBusy(true);
    await apiDeleteMailbox(getMailboxLocalPart(mb.address));
    onDeleted?.(mb);
    await load(page, search);
    setBusy(false);
  };

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/20 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide">{t('history.mailboxList')}</h2>
        <div className="flex items-center gap-1">
          {mailboxes.length > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={busy || selected.size === 0}
              className="px-3 py-2 min-h-10 text-xs rounded-md hover:bg-muted transition-colors text-muted-foreground disabled:opacity-40"
            >
              {t('history.deleteSelected')}
            </button>
          )}
          <button
            onClick={() => load(page, search)}
            disabled={busy}
            className="p-2 min-w-10 min-h-10 rounded-md hover:bg-muted transition-colors text-muted-foreground"
            title={t('common.refresh')}
          >
            <i className={`fas fa-sync-alt text-sm ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      <div className="px-4 py-2 border-b bg-muted/5">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('history.searchMailbox')}
          className="w-full px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label={t('history.searchMailbox')}
        />
      </div>
      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
      ) : mailboxes.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          {search ? t('history.noSearchResults') : t('history.noMailboxes')}
        </div>
      ) : (
        <>
          <div className="hidden sm:grid grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,7.5rem)_auto_auto] gap-2 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b bg-muted/10 items-center">
            <input
              type="checkbox"
              checked={allPageSelected}
              onChange={toggleSelectAll}
              className="rounded"
            />
            <span>{t('mailbox.address')}</span>
            <span>{t('email.subject')}</span>
            <span>{t('email.ruleExtract')}</span>
            <span className="text-right">{t('mailbox.expiresAt')}</span>
            <span />
          </div>
          <div className="divide-y">
            {mailboxes.map((mb) => {
              const key = mailboxIdentityKey(mb);
              const full = formatMailboxDisplayEmail(mb);
              const isActive = activeMailbox ? isSameMailbox(mb, activeMailbox) : false;
              const latest = mb.latestEmail;
              const subject = latest?.subject?.trim() || t('email.noSubject');
              return (
                <div
                  key={key}
                  className={`px-4 py-3 grid sm:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,7.5rem)_auto_auto] gap-2 items-center text-sm ${
                    isActive ? 'bg-primary/5' : 'hover:bg-muted/30'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(key)}
                    onChange={() => toggleSelect(key)}
                    className="rounded"
                  />
                  <button
                    onClick={() => onSelect(mb)}
                    className="min-w-0 text-left font-mono truncate text-primary hover:underline"
                    title={full}
                  >
                    {full}
                  </button>
                  <p className="min-w-0 truncate text-muted-foreground" title={subject}>
                    {subject}
                  </p>
                  <div className="min-w-0 flex items-center">
                    {latest?.extractedCode ? (
                      <OtpBox
                        code={latest.extractedCode}
                        size="sm"
                        className="shrink-0"
                        matchedRuleId={latest.matchedRuleId}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">{t('email.noExtractedCode')}</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap sm:text-right">
                    {formatMailboxTimeLeft(mb.expiresAt, t, { later: true })}
                  </span>
                  <div className="flex sm:justify-end">
                    <button
                      onClick={() => handleDeleteOne(mb)}
                      disabled={busy}
                      className="text-muted-foreground hover:text-destructive p-2 min-w-8 min-h-8"
                      title={t('common.delete')}
                    >
                      <i className="fas fa-trash-alt text-xs" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <ListPagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            disabled={busy || loading}
          />
        </>
      )}
    </div>
  );
};

export default MailboxHistoryList;
