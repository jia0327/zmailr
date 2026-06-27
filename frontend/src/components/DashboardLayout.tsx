import React, { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DashboardSidebar from './DashboardSidebar';
import AnnouncementModal from './AnnouncementModal';
import SEO from './SEO';
import { API_BASE_URL } from '../config';

const SIDEBAR_COLLAPSED_KEY = 'dashboardSidebarCollapsed';

interface PublicMaintenance {
  enabled: boolean;
  message: string;
  displayMessage?: string;
}

const DashboardLayout: React.FC = () => {
  const { t } = useTranslation();
  const [maintenance, setMaintenance] = useState<PublicMaintenance | null>(null);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    } catch {
      // ignore
    }
  }, [collapsed]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/public/status`);
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && data.success && data.maintenance?.enabled) {
          setMaintenance({
            enabled: true,
            message:
              data.maintenance.displayMessage ||
              data.maintenance.message ||
              t('dashboard.maintenanceDefault'),
          });
        }
      } catch {
        // ignore — banner is optional
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const toggleSidebar = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const openMobile = useCallback(() => setMobileOpen(true), []);

  return (
    <div className="flex min-h-screen bg-background">
      <SEO title={t('seo.dashboardTitle')} description={t('seo.dashboardDescription')} />

      {mobileOpen && (
        <button
          type="button"
          aria-label={t('dashboard.closeMenu')}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={closeMobile}
        />
      )}

      <DashboardSidebar
        collapsed={collapsed}
        onToggle={toggleSidebar}
        mobileOpen={mobileOpen}
        onMobileClose={closeMobile}
      />

      <div className="flex-1 flex flex-col min-w-0 w-full overflow-hidden">
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b bg-card shrink-0">
          <button
            type="button"
            onClick={openMobile}
            aria-label={t('dashboard.openMenu')}
            className="flex items-center justify-center w-10 h-10 rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors shrink-0"
          >
            <i className="fas fa-bars text-lg" />
          </button>
          <span className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-lg bg-sky-500/15 flex items-center justify-center shrink-0">
              <i className="fas fa-envelope text-xs text-sky-600 dark:text-sky-400" />
            </span>
            <span className="text-lg font-bold tracking-tight truncate">zMailR</span>
          </span>
        </header>

        <AnnouncementModal />
        {maintenance?.enabled && (
          <div
            role="status"
            className="mx-4 md:mx-6 lg:mx-8 mt-4 md:mt-6 px-4 py-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100 text-sm shrink-0"
          >
            <i className="fas fa-wrench mr-2" aria-hidden />
            {maintenance.message}
          </div>
        )}
        <main className="dashboard-main relative flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8">
          <div className="relative z-[1]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
