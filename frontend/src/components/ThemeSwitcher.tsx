import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface ThemeSwitcherProps {
  variant?: 'default' | 'sidebar';
  collapsed?: boolean;
}

/**
 * 主题切换组件
 * 用于在明亮和暗黑模式之间切换
 */
const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ variant = 'default', collapsed = false }) => {
  const { t } = useTranslation();

  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme || 'dark';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove(theme === 'light' ? 'dark' : 'light');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
    localStorage.setItem('vitepress-theme-appearance', theme);
  }, [theme]);

  const segmentClass = (active: boolean) =>
    `flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
      active
        ? 'bg-background text-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
    }`;

  if (variant === 'sidebar') {
    const icon =
      theme === 'light' ? (
        <i className="fas fa-moon w-4 text-center shrink-0" />
      ) : (
        <i className="fas fa-sun w-4 text-center shrink-0" />
      );

    return (
      <button
        type="button"
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        className={`flex items-center rounded-md text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors min-h-10 w-full ${
          collapsed ? 'md:justify-center md:px-2 md:py-2.5 gap-3 px-3 py-2' : 'gap-3 px-3 py-2'
        }`}
        aria-label={t('settings.toggleTheme')}
        title={t('settings.toggleTheme')}
      >
        {icon}
        <span className={collapsed ? 'md:sr-only' : undefined}>{t('settings.theme')}</span>
      </button>
    );
  }

  return (
    <div
      className="inline-flex items-center rounded-lg border border-border bg-muted/30 p-0.5 shrink-0"
      role="group"
      aria-label={t('settings.toggleTheme')}
    >
      <button
        type="button"
        onClick={() => setTheme('light')}
        className={segmentClass(theme === 'light')}
        aria-label={t('settings.lightMode')}
        aria-pressed={theme === 'light'}
        title={t('settings.lightMode')}
      >
        <i className="fas fa-sun text-sm" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => setTheme('dark')}
        className={segmentClass(theme === 'dark')}
        aria-label={t('settings.darkMode')}
        aria-pressed={theme === 'dark'}
        title={t('settings.darkMode')}
      >
        <i className="fas fa-moon text-sm" aria-hidden />
      </button>
    </div>
  );
};

export default ThemeSwitcher;
