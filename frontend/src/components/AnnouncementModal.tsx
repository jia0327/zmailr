import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import {
  AnnouncementItem,
  getUnreadAnnouncements,
  markAllAnnouncementsRead,
  markAnnouncementRead,
} from '../utils/api';

const AnnouncementModal: React.FC = () => {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading } = useAuth();
  const [queue, setQueue] = useState<AnnouncementItem[]>([]);
  const [dismissing, setDismissing] = useState(false);

  const loadUnread = useCallback(async () => {
    const result = await getUnreadAnnouncements();
    if (result.success) {
      setQueue(result.announcements);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      loadUnread();
    }
  }, [isLoading, isAuthenticated, loadUnread]);

  const current = queue[0];
  if (!current) return null;

  const remaining = queue.length - 1;

  const dismissCurrent = async () => {
    if (dismissing) return;
    setDismissing(true);
    await markAnnouncementRead(current.id);
    setQueue((prev) => prev.slice(1));
    setDismissing(false);
  };

  const dismissAll = async () => {
    if (dismissing) return;
    setDismissing(true);
    await markAllAnnouncementsRead();
    setQueue([]);
    setDismissing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-16 sm:pt-24">
      <div
        className="w-full max-w-lg rounded-lg border border-border bg-card shadow-xl"
        role="dialog"
        aria-labelledby="announcement-title"
        aria-modal="true"
      >
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <i className="fas fa-bullhorn text-sm" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('announcements.label')}
              </p>
              <h2 id="announcement-title" className="mt-1 text-lg font-semibold text-foreground">
                {current.title}
              </h2>
            </div>
          </div>
        </div>
        <div className="max-h-[50vh] overflow-y-auto px-5 py-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {current.content}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4">
          <span className="text-xs text-muted-foreground">
            {remaining > 0
              ? t('announcements.remaining', { count: remaining })
              : t('announcements.lastOne')}
          </span>
          <div className="flex flex-wrap gap-2">
            {remaining > 0 && (
              <button
                type="button"
                onClick={dismissAll}
                disabled={dismissing}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                {t('announcements.markAllRead')}
              </button>
            )}
            <button
              type="button"
              onClick={dismissCurrent}
              disabled={dismissing}
              className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {t('announcements.markRead')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementModal;
