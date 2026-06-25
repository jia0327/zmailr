import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import ThemeSwitcher from './ThemeSwitcher';
import LanguageSwitcher from './LanguageSwitcher';

interface DashboardSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
}) => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const initial = user?.username?.charAt(0).toUpperCase() || '?';

  const handleLogout = async () => {
    onMobileClose();
    await logout();
    navigate('/login');
  };

  const handleNavClick = () => {
    onMobileClose();
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center rounded-md text-sm transition-colors min-h-10 ${
      collapsed ? 'md:justify-center md:px-2 md:py-2.5' : 'gap-3 px-3 py-2'
    } ${
      isActive
        ? 'bg-primary/10 text-foreground font-medium'
        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
    }`;

  const linkLabel = (text: string) => (
    <span className={collapsed ? 'md:sr-only' : undefined}>{text}</span>
  );

  const toggleTitle = collapsed ? t('dashboard.expandSidebar') : t('dashboard.collapseSidebar');

  return (
    <aside
      className={`fixed md:relative inset-y-0 left-0 z-50 border-r bg-card flex flex-col min-h-screen transition-[transform,width] duration-300 ease-in-out w-60 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0 ${collapsed ? 'md:w-16' : 'md:w-60'}`}
    >
      <div className={`border-b ${collapsed ? 'md:p-2 p-4' : 'p-4'}`}>
        <div
          className={`flex items-center ${
            collapsed ? 'md:justify-center justify-between gap-2 mb-3' : 'justify-between gap-2 mb-3'
          }`}
        >
          <span className={`text-lg font-bold tracking-tight ${collapsed ? 'md:hidden' : ''}`}>
            zMailR
          </span>
          <button
            type="button"
            onClick={onMobileClose}
            title={t('dashboard.closeMenu')}
            aria-label={t('dashboard.closeMenu')}
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors shrink-0"
          >
            <i className="fas fa-times text-sm" />
          </button>
          <button
            type="button"
            onClick={onToggle}
            title={toggleTitle}
            aria-label={toggleTitle}
            className="hidden md:flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors shrink-0"
          >
            <i className={`fas ${collapsed ? 'fa-chevron-right' : 'fa-chevron-left'} text-sm`} />
          </button>
        </div>
        <div className={`flex items-center ${collapsed ? 'md:justify-center gap-3' : 'gap-3'}`}>
          <div
            className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold shrink-0"
            title={user?.username}
          >
            {initial}
          </div>
          <div className={`min-w-0 ${collapsed ? 'md:hidden' : ''}`}>
            <p className="text-sm font-medium truncate">{user?.username}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.role}</p>
          </div>
        </div>
      </div>

      <nav
        className={`flex-1 overflow-y-auto ${
          collapsed ? 'md:p-2 md:space-y-1 p-3 space-y-6' : 'p-3 space-y-6'
        }`}
      >
        <div>
          <p
            className={`px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground ${
              collapsed ? 'md:hidden' : ''
            }`}
          >
            {t('dashboard.sectionActions')}
          </p>
          <div className="space-y-1">
            <NavLink to="/dashboard/usage" className={navLinkClass} title={t('dashboard.usage')} onClick={handleNavClick}>
              <i className="fas fa-chart-bar w-4 text-center shrink-0" />
              {linkLabel(t('dashboard.usage'))}
            </NavLink>
            <NavLink to="/dashboard/inbox" className={navLinkClass} title={t('dashboard.inbox')} onClick={handleNavClick}>
              <i className="fas fa-inbox w-4 text-center shrink-0" />
              {linkLabel(t('dashboard.inbox'))}
            </NavLink>
            <NavLink to="/dashboard/outbox" className={navLinkClass} title={t('dashboard.outbox')} onClick={handleNavClick}>
              <i className="fas fa-paper-plane w-4 text-center shrink-0" />
              {linkLabel(t('dashboard.outbox'))}
            </NavLink>
            <NavLink to="/dashboard/api-keys" className={navLinkClass} title={t('dashboard.apiKeys')} onClick={handleNavClick}>
              <i className="fas fa-key w-4 text-center shrink-0" />
              {linkLabel(t('dashboard.apiKeys'))}
            </NavLink>
            <NavLink to="/dashboard/api-debug" className={navLinkClass} title={t('dashboard.apiDebug')} onClick={handleNavClick}>
              <i className="fas fa-terminal w-4 text-center shrink-0" />
              {linkLabel(t('dashboard.apiDebug'))}
            </NavLink>
            <NavLink to="/dashboard/extract-rules" className={navLinkClass} title={t('dashboard.extractRules')} onClick={handleNavClick}>
              <i className="fas fa-filter w-4 text-center shrink-0" />
              {linkLabel(t('dashboard.extractRules'))}
            </NavLink>
          </div>
        </div>
      </nav>

      <div className={`border-t space-y-2 ${collapsed ? 'md:p-2 p-3' : 'p-3'}`}>
        <div className={`flex items-center ${collapsed ? 'md:justify-center gap-1 px-1' : 'gap-1 px-1'}`}>
          <ThemeSwitcher />
          <LanguageSwitcher />
        </div>
        <div className={`flex flex-col gap-1 text-sm ${collapsed ? 'md:items-center' : ''}`}>
          <NavLink to="/api-docs" className={navLinkClass} title={t('dashboard.docs')} onClick={handleNavClick}>
            <i className="fas fa-book w-4 text-center shrink-0" />
            {linkLabel(t('dashboard.docs'))}
          </NavLink>
          <a
            href="https://github.com/jia0327/zmailr"
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub"
            onClick={handleNavClick}
            className={`flex items-center rounded-md text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors min-h-10 ${
              collapsed ? 'md:justify-center md:px-2 md:py-2.5 gap-3 px-3 py-2' : 'gap-3 px-3 py-2'
            }`}
          >
            <i className="fab fa-github w-4 text-center shrink-0" />
            {linkLabel('GitHub')}
          </a>
        </div>
        <button
          onClick={handleLogout}
          title={t('auth.logout')}
          className={`flex items-center rounded-md text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors min-h-10 ${
            collapsed ? 'md:w-full md:justify-center md:px-2 md:py-2.5 w-full gap-3 px-3 py-2' : 'w-full gap-3 px-3 py-2'
          }`}
        >
          <i className="fas fa-sign-out-alt w-4 text-center shrink-0" />
          {linkLabel(t('auth.logout'))}
        </button>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
