import React, { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DashboardSidebar from './DashboardSidebar';
import AnnouncementModal from './AnnouncementModal';
import SEO from './SEO';

const SIDEBAR_COLLAPSED_KEY = 'dashboardSidebarCollapsed';

const DashboardLayout: React.FC = () => {
  const { t } = useTranslation();
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

  const toggleSidebar = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const openMobile = useCallback(() => setMobileOpen(true), []);

  return (
    <div className="flex min-h-screen bg-background">
      <SEO title="zMailR Dashboard" description="zMailR temporary email dashboard" />

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
          <span className="text-lg font-bold tracking-tight truncate">zMailR</span>
        </header>

        <AnnouncementModal />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
