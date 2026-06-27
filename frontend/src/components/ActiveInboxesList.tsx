import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getUserMailboxes, deleteMailbox as apiDeleteMailbox, UserMailboxItem } from '../utils/api';
import {
  formatMailboxDisplayEmail,
  getMailboxLocalPart,
  isSameMailbox,
  userMailboxItemToMailbox,
} from '../utils/mailbox';

interface ActiveInboxesListProps {
  activeMailbox?: Mailbox | null;
  onSelect: (mailbox: UserMailboxItem) => void;
  onRefresh?: () => void;
}

const ActiveInboxesList: React.FC<ActiveInboxesListProps> = ({
  activeMailbox,
  onSelect,
  onRefresh,
}) => {
  const { t } = useTranslation();
  const [mailboxes, setMailboxes] = useState<UserMailboxItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const result = await getUserMailboxes();
    if (result.success) setMailboxes(result.mailboxes);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const fmtExpiry = (expiresAt: number) => {
    const now = Math.floor(Date.now() / 1000);
    const left = expiresAt - now;
    if (left <= 0) return t('mailbox.expired');
    const hours = Math.floor(left / 3600);
    const minutes = Math.floor((left % 3600) / 60);
    if (hours > 0) return t('mailbox.expiresInTime', { hours, minutes });
    return t('mailbox.expiresInMinutes', { minutes });
  };

  const handleDelete = async (mb: UserMailboxItem) => {
    if (!confirm(t('mailbox.confirmDelete'))) return;
    await apiDeleteMailbox(getMailboxLocalPart(mb.address));
    await load();
    onRefresh?.();
  };

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/20 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide">{t('dashboard.activeInboxes')}</h2>
        <button
          onClick={load}
          className="p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground"
          title={t('common.refresh')}
        >
          <i className={`fas fa-sync-alt text-sm ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
      ) : mailboxes.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">{t('dashboard.noActiveInboxes')}</div>
      ) : (
        <div className="divide-y max-h-64 overflow-y-auto">
          {mailboxes.map((mb) => {
            const full = formatMailboxDisplayEmail(mb);
            const isActive = activeMailbox
              ? isSameMailbox(userMailboxItemToMailbox(mb), activeMailbox)
              : false;
            return (
              <div
                key={full}
                className={`px-4 py-3 flex items-center gap-3 text-sm ${
                  isActive ? 'bg-primary/5' : 'hover:bg-muted/30'
                }`}
              >
                <button
                  onClick={() => onSelect(mb)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="font-mono truncate">{full}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{fmtExpiry(mb.expiresAt)}</p>
                </button>
                <button
                  onClick={() => handleDelete(mb)}
                  className="text-muted-foreground hover:text-destructive p-1"
                  title={t('common.delete')}
                >
                  <i className="fas fa-trash-alt text-xs" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ActiveInboxesList;
