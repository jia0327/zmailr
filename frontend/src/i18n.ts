import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const localeLoaders: Record<string, () => Promise<{ default: Record<string, unknown> }>> = {
  'zh-CN': () => import('../i18n/locales/zh-CN.json'),
  en: () => import('../i18n/locales/en.json'),
};

export const CORE_LOCALES = ['zh-CN', 'en'] as const;
export type CoreLocale = (typeof CORE_LOCALES)[number];

function normalizeLocale(lng: string | null | undefined): CoreLocale {
  if (!lng) return 'en';
  if (lng === 'zh-CN' || lng === 'en') return lng;
  if (lng.startsWith('zh')) return 'zh-CN';
  if (lng.startsWith('en')) return 'en';
  return 'en';
}

function detectPreferredLocale(): CoreLocale {
  try {
    const stored = localStorage.getItem('i18nextLng');
    if (stored) {
      return normalizeLocale(stored);
    }
  } catch {
    // ignore
  }

  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en';
  return normalizeLocale(nav);
}

async function loadLocaleBundle(lng: string): Promise<Record<string, unknown> | null> {
  const loader = localeLoaders[lng];
  if (!loader) return null;
  const mod = await loader();
  return mod.default;
}

export async function ensureLocaleLoaded(lng: string): Promise<void> {
  const normalized = normalizeLocale(lng);
  if (i18n.hasResourceBundle(normalized, 'translation')) {
    return;
  }
  const bundle = await loadLocaleBundle(normalized);
  if (bundle) {
    i18n.addResourceBundle(normalized, 'translation', bundle, true, true);
  }
}

async function buildInitialResources(): Promise<Record<string, { translation: Record<string, unknown> }>> {
  const entries = await Promise.all(
    CORE_LOCALES.map(async (lng) => {
      const bundle = await loadLocaleBundle(lng);
      return bundle ? ([lng, { translation: bundle }] as const) : null;
    }),
  );

  return Object.fromEntries(entries.filter(Boolean) as [string, { translation: Record<string, unknown> }][]) as Record<
    string,
    { translation: Record<string, unknown> }
  >;
}

let initPromise: Promise<typeof i18n> | null = null;

export function initI18n(): Promise<typeof i18n> {
  if (!initPromise) {
    initPromise = (async () => {
      const preferred = detectPreferredLocale();
      const resources = await buildInitialResources();

      await i18n
        .use(LanguageDetector)
        .use(initReactI18next)
        .init({
          resources,
          lng: preferred,
          fallbackLng: [...CORE_LOCALES],
          supportedLngs: [...CORE_LOCALES],
          nonExplicitSupportedLngs: true,
          debug: import.meta.env.MODE === 'development',
          interpolation: {
            escapeValue: false,
          },
          detection: {
            order: ['localStorage', 'navigator', 'htmlTag', 'path'],
            caches: ['localStorage'],
            convertDetectedLanguage: (lng) => normalizeLocale(lng),
          },
        });

      i18n.on('languageChanged', (lng) => {
        void ensureLocaleLoaded(lng);
      });

      return i18n;
    })();
  }
  return initPromise;
}

export default i18n;
