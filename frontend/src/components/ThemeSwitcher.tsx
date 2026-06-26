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
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const icon =
    theme === 'light' ? (
      <i className="fas fa-moon w-4 text-center shrink-0" />
    ) : (
      <i className="fas fa-sun w-4 text-center shrink-0" />
    );

  if (variant === 'sidebar') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
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
    <button
      type="button"
      onClick={toggleTheme}
      className="w-8 h-8 flex items-center justify-center rounded-md transition-all duration-200 hover:bg-primary/20 hover:text-primary hover:scale-110"
      aria-label={t('settings.toggleTheme')}
      title={t('settings.toggleTheme')}
    >
      {theme === 'light' ? (
        <i className="fas fa-moon text-base" />
      ) : (
        <i className="fas fa-sun text-base" />
      )}
    </button>
  );
};

export default ThemeSwitcher;