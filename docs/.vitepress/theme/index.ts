import DefaultTheme from 'vitepress/theme';
import { inBrowser } from 'vitepress';
import SiteOrigin from './components/SiteOrigin.vue';
import ExampleMailbox from './components/ExampleMailbox.vue';
import SiteLink from './components/SiteLink.vue';
import './custom.css';

const VP_THEME_KEY = 'vitepress-theme-appearance';
const APP_THEME_KEY = 'theme';

type ThemeMode = 'dark' | 'light';

function resolveTheme(): ThemeMode {
  const appTheme = localStorage.getItem(APP_THEME_KEY);
  if (appTheme === 'dark' || appTheme === 'light') {
    return appTheme;
  }
  const vpTheme = localStorage.getItem(VP_THEME_KEY);
  if (vpTheme === 'dark' || vpTheme === 'light') {
    return vpTheme;
  }
  return 'dark';
}

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.remove('dark', 'light');
  root.classList.add(mode);
  localStorage.setItem(APP_THEME_KEY, mode);
  localStorage.setItem(VP_THEME_KEY, mode);
}

function syncThemeKeys() {
  applyTheme(resolveTheme());
}

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('SiteOrigin', SiteOrigin);
    app.component('ExampleMailbox', ExampleMailbox);
    app.component('SiteLink', SiteLink);
    if (inBrowser) {
      syncThemeKeys();
    }
  },
};
