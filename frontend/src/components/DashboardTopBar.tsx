import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import ThemeSwitcher from './ThemeSwitcher';

interface DashboardTopBarProps {
  variant?: 'desktop' | 'mobile';
  onNavigate?: () => void;
}

const iconLinkClass =
  'flex items-center justify-center w-9 h-9 rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors shrink-0';

const textLinkClass =
  'text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50';

const DashboardTopBar: React.FC<DashboardTopBarProps> = ({ variant = 'desktop', onNavigate }) => {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    onNavigate?.();
    await logout();
    navigate('/login');
  };

  if (variant === 'mobile') {
    return (
      <div className="flex items-center gap-0.5 shrink-0">
        <a
          href="/docs/"
          className={iconLinkClass}
          title={t('dashboard.docs')}
          aria-label={t('dashboard.docs')}
          onClick={onNavigate}
        >
          <i className="fas fa-book text-sm" />
        </a>
        <a
          href="https://github.com/jia0327/zmailr"
          target="_blank"
          rel="noopener noreferrer"
          className={iconLinkClass}
          title="GitHub"
          aria-label="GitHub"
          onClick={onNavigate}
        >
          <i className="fab fa-github text-sm" />
        </a>
        <ThemeSwitcher />
        <button
          type="button"
          onClick={handleLogout}
          className={iconLinkClass}
          title={t('auth.logout')}
          aria-label={t('auth.logout')}
        >
          <i className="fas fa-sign-out-alt text-sm" />
        </button>
      </div>
    );
  }

  return (
    <header
      className="hidden md:flex items-center justify-end gap-1 px-4 lg:px-8 py-2.5 border-b border-sky-200/50 dark:border-border bg-card/80 backdrop-blur-sm shrink-0"
    >
      <a href="/docs/" className={textLinkClass}>
        {t('dashboard.docs')}
      </a>
      <a
        href="https://github.com/jia0327/zmailr"
        target="_blank"
        rel="noopener noreferrer"
        className={textLinkClass}
      >
        GitHub
      </a>
      <ThemeSwitcher />
      <button type="button" onClick={handleLogout} className={textLinkClass}>
        {t('auth.logout')}
      </button>
    </header>
  );
};

export default DashboardTopBar;
