import React, { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MailboxContext } from '../contexts/MailboxContext';
import EmailDetail from './EmailDetail';
import OtpBox from './OtpBox';
import { deleteUserEmails } from '../utils/api';

interface EmailListProps {
  emails: Email[];
  selectedEmailId: string | null;
  onSelectEmail: (id: string | null) => void;
  isLoading: boolean;
}

const EmailList: React.FC<EmailListProps> = ({
  emails,
  selectedEmailId,
  onSelectEmail,
  isLoading
}) => {
  const { t } = useTranslation();
  const { autoRefresh, setAutoRefresh, refreshEmails, mailbox, deleteMailbox, showSuccessMessage, showErrorMessage, setEmails, setSelectedEmail } = useContext(MailboxContext);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const calculateTimeLeft = (expiresAt: number) => {
    if (!expiresAt) return '';

    const now = Math.floor(Date.now() / 1000);
    const timeLeftSeconds = expiresAt - now;

    if (timeLeftSeconds <= 0) return t('mailbox.expired');

    const hours = Math.floor(timeLeftSeconds / 3600);
    const minutes = Math.floor((timeLeftSeconds % 3600) / 60);

    if (hours > 0) {
      return t('mailbox.expiresInTime', { hours, minutes });
    }
    return t('mailbox.expiresInMinutes', { minutes });
  };

  const handleRefresh = () => refreshEmails(true);
  const toggleAutoRefresh = () => setAutoRefresh(!autoRefresh);

  const handleDeleteMailbox = async () => {
    if (window.confirm(t('mailbox.confirmDelete'))) {
      setIsDeleting(true);
      try {
        await deleteMailbox();
      } catch (error) {
        console.error('Error deleting mailbox:', error);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === emails.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(emails.map((e) => e.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (!mailbox || selectedIds.size === 0) return;
    if (!confirm(t('history.confirmDeleteEmails', { count: selectedIds.size }))) return;
    setBulkBusy(true);
    const result = await deleteUserEmails({
      mailboxAddress: mailbox.address,
      ids: Array.from(selectedIds),
    });
    if (result.success) {
      setEmails(emails.filter((e) => !selectedIds.has(e.id)));
      if (selectedEmailId && selectedIds.has(selectedEmailId)) setSelectedEmail(null);
      setSelectedIds(new Set());
      showSuccessMessage(t('email.deleteSuccess'));
    } else {
      showErrorMessage(t('email.deleteFailed'));
    }
    setBulkBusy(false);
  };

  const handleDeleteAll = async () => {
    if (!mailbox || emails.length === 0) return;
    if (!confirm(t('history.confirmClearAllEmails'))) return;
    setBulkBusy(true);
    const result = await deleteUserEmails({ mailboxAddress: mailbox.address, all: true });
    if (result.success) {
      setEmails([]);
      setSelectedEmail(null);
      setSelectedIds(new Set());
      showSuccessMessage(t('email.deleteSuccess'));
    } else {
      showErrorMessage(t('email.deleteFailed'));
    }
    setBulkBusy(false);
  };

  if (isLoading || isDeleting || bulkBusy) {
    return (
      <div className="border rounded-md">
        <div className="flex justify-center items-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-muted-foreground/20 border-t-foreground"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-md overflow-hidden">
      {/* Inbox toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b bg-muted/20">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide">{t('email.inbox')}</h2>
          <span className="text-xs text-muted-foreground">
            {emails.length} {emails.length === 1 ? t('email.message') : t('email.messages')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {emails.length > 0 && (
            <>
              <button
                onClick={handleDeleteSelected}
                disabled={selectedIds.size === 0}
                className="px-2 py-1 text-xs rounded-md hover:bg-muted transition-colors text-muted-foreground disabled:opacity-40"
              >
                {t('history.deleteSelected')}
              </button>
              <button
                onClick={handleDeleteAll}
                className="px-2 py-1 text-xs rounded-md hover:bg-muted transition-colors text-muted-foreground"
              >
                {t('history.clearAll')}
              </button>
            </>
          )}
          {mailbox && (
            <span className="text-xs text-muted-foreground mr-2 hidden md:inline">
              {calculateTimeLeft(mailbox.expiresAt)}
            </span>
          )}
          <button
            onClick={handleRefresh}
            className="p-2 rounded-md hover:bg-muted transition-colors"
            title={t('email.refresh')}
          >
            <i className="fas fa-sync-alt text-sm"></i>
          </button>
          <button
            onClick={toggleAutoRefresh}
            className={`p-2 rounded-md transition-colors ${autoRefresh ? 'text-foreground' : 'text-muted-foreground'}`}
            title={autoRefresh ? t('email.autoRefreshOn') : t('email.autoRefreshOff')}
          >
            <i className="fas fa-clock text-sm"></i>
          </button>
          {mailbox && (
            <button
              onClick={handleDeleteMailbox}
              className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
              title={t('mailbox.delete')}
            >
              <i className="fas fa-trash-alt text-sm"></i>
            </button>
          )}
        </div>
      </div>

      {emails.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <i className="fas fa-inbox text-3xl mb-3 opacity-40"></i>
          <p className="text-sm">{t('email.emptyInbox')}</p>
          <p className="text-xs mt-1">{t('email.waitingForEmails')}</p>
        </div>
      ) : (
        <>
          {/* Table header */}
          <div className="hidden sm:grid grid-cols-[auto_1fr_2fr_auto] gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b bg-muted/10 items-center">
            <input
              type="checkbox"
              checked={selectedIds.size === emails.length && emails.length > 0}
              onChange={toggleSelectAll}
              className="rounded"
            />
            <span>{t('email.from')}</span>
            <span>{t('email.subject')}</span>
            <span className="text-right">{t('email.date')}</span>
          </div>

          <ul>
            {emails.map((email) => (
              <React.Fragment key={email.id}>
                <li
                  className={`grid sm:grid-cols-[auto_1fr_2fr_auto] gap-2 sm:gap-4 items-center px-4 py-3 cursor-pointer border-b last:border-b-0 transition-colors hover:bg-muted/30 ${
                    selectedEmailId === email.id ? 'bg-muted/50' : ''
                  } ${!email.isRead ? 'font-medium' : ''}`}
                  onClick={() => onSelectEmail(selectedEmailId === email.id ? null : email.id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(email.id)}
                    onChange={() => {}}
                    onClick={(e) => toggleSelect(email.id, e)}
                    className="rounded"
                  />
                  <div className="min-w-0">
                    <span className="text-sm truncate block">
                      {email.fromName || email.fromAddress}
                    </span>
                  </div>
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="text-sm truncate font-normal">
                      {email.subject || t('email.noSubject')}
                    </span>
                    {email.extractedCode && (
                      <OtpBox
                        code={email.extractedCode}
                        size="sm"
                        className="shrink-0"
                        onCopy={() => showSuccessMessage(t('common.copied'))}
                      />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap sm:text-right font-normal">
                    {formatDate(email.receivedAt)}
                  </span>
                </li>
                {selectedEmailId === email.id && (
                  <li className="border-b bg-muted/10">
                    <EmailDetail
                      emailId={email.id}
                      onClose={() => onSelectEmail(null)}
                    />
                  </li>
                )}
              </React.Fragment>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default EmailList;
