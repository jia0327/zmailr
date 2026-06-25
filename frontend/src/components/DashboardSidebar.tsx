import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import ThemeSwitcher from './ThemeSwitcher';
import LanguageSwitcher from './LanguageSwitcher';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
    isActive
      ? 'bg-primary/10 text-foreground font-medium'
      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
  }`;

const DashboardSidebar: React.FC = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const initial = user?.username?.charAt(0).toUpperCase() || '?';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className="w-60 shrink-0 border-r bg-card flex flex-col min-h-screen">
      <div className="p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user?.username}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.role}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-6 overflow-y-auto">
        <div>
          <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('dashboard.sectionActions')}
          </p>
          <div className="space-y-1">
            <NavLink to="/dashboard/inbox" className={navLinkClass}>
              <i className="fas fa-inbox w-4 text-center" />
              {t('dashboard.inbox')}
            </NavLink>
            <NavLink to="/dashboard/outbox" className={navLinkClass}>
              <i className="fas fa-paper-plane w-4 text-center" />
              {t('dashboard.outbox')}
            </NavLink>
            <NavLink to="/dashboard/api-keys" className={navLinkClass}>
              <i className="fas fa-key w-4 text-center" />
              {t('dashboard.apiKeys')}
            </NavLink>
            <NavLink to="/dashboard/usage" className={navLinkClass}>
              <i className="fas fa-chart-bar w-4 text-center" />
              {t('dashboard.usage')}
            </NavLink>
          </div>
        </div>

        <div>
          <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('dashboard.sectionSettings')}
          </p>
          <div className="space-y-1">
            <span className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground/50 cursor-not-allowed">
              <i className="fas fa-credit-card w-4 text-center" />
              {t('dashboard.billing')}
            </span>
          </div>
        </div>
      </nav>

      <div className="p-3 border-t space-y-2">
        <div className="flex items-center gap-1 px-1">
          <ThemeSwitcher />
          <LanguageSwitcher />
        </div>
        <div className="flex flex-col gap-1 text-sm">
          <NavLink to="/api-docs" className={navLinkClass}>
            <i className="fas fa-book w-4 text-center" />
            {t('dashboard.docs')}
          </NavLink>
          <a
            href="https://github.com/jia0327/zmailr"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          >
            <i className="fab fa-github w-4 text-center" />
            GitHub
          </a>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
        >
          <i className="fas fa-sign-out-alt w-4 text-center" />
          {t('auth.logout')}
        </button>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
