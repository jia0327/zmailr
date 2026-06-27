import DefaultTheme from 'vitepress/theme';
import { inBrowser } from 'vitepress';
import './custom.css';

const VP_THEME_KEY = 'vitepress-theme-appearance';
const APP_THEME_KEY = 'theme';

function syncThemeKeys() {
  const appTheme = localStorage.getItem(APP_THEME_KEY);
  if (appTheme === 'dark' || appTheme === 'light') {
    localStorage.setItem(VP_THEME_KEY, appTheme);
    return;
  }
  const vpTheme = localStorage.getItem(VP_THEME_KEY);
  if (vpTheme === 'dark' || vpTheme === 'light') {
    localStorage.setItem(APP_THEME_KEY, vpTheme);
    return;
  }
  localStorage.setItem(APP_THEME_KEY, 'dark');
  localStorage.setItem(VP_THEME_KEY, 'dark');
}

export default {
  extends: DefaultTheme,
  enhanceApp() {
    if (inBrowser) {
      syncThemeKeys();
    }
  },
};
