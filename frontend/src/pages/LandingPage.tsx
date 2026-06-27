import React, { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import SEO from '../components/SEO';
import ThemeSwitcher from '../components/ThemeSwitcher';
import {
  curlQuickstart,
  getApiBaseUrl,
  mcpQuickstart,
  quickstartResponseLine,
} from '../utils/apiDocExamples';
import {
  LANDING_MCP_GROUPS,
  LANDING_REST_API_GROUPS,
  methodBadgeClass,
  type ApiShowcaseGroup,
  type ApiShowcaseItem,
} from '../utils/landingApiShowcase';
import { copyTextToClipboard } from '../utils/clipboard';

type QuickstartTab = 'curl' | 'mcp';

const WORKS_WITH = ['CI / 脚本', 'Playwright', 'Cursor', 'Claude', 'MCP', 'OpenAPI'] as const;

const FEATURES = [
  { icon: 'fas fa-envelope', titleKey: 'landing.primitiveReceiveTitle', descKey: 'landing.primitiveReceiveDesc' },
  { icon: 'fas fa-clock', titleKey: 'landing.primitivePollTitle', descKey: 'landing.primitivePollDesc' },
  { icon: 'fas fa-robot', titleKey: 'landing.primitiveAgentTitle', descKey: 'landing.primitiveAgentDesc' },
  { icon: 'fas fa-inbox', titleKey: 'landing.consoleInbox', descKey: 'landing.consoleInboxDesc' },
  { icon: 'fas fa-paper-plane', titleKey: 'landing.consoleOutbox', descKey: 'landing.consoleOutboxDesc' },
  { icon: 'fas fa-filter', titleKey: 'landing.consoleRules', descKey: 'landing.consoleRulesDesc' },
  { icon: 'fas fa-key', titleKey: 'landing.consoleApiKeys', descKey: 'landing.consoleApiKeysDesc' },
  { icon: 'fas fa-terminal', titleKey: 'landing.consoleDebug', descKey: 'landing.consoleDebugDesc' },
  { icon: 'fas fa-chart-bar', titleKey: 'landing.consoleUsage', descKey: 'landing.consoleUsageDesc' },
] as const;

const SHOWCASE_PANEL_H = 'min-h-[420px] lg:h-[440px]';

const ApiShowcaseCard: React.FC<{ item: ApiShowcaseItem }> = ({ item }) => (
  <div className="rounded-lg bg-white/5 border border-white/10 p-3">
    <div className="flex items-start justify-between gap-3 mb-2">
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <span className={`px-1.5 py-0.5 rounded font-semibold shrink-0 ${methodBadgeClass(item.method)}`}>
          {item.method}
        </span>
        <span className="text-[#8b949e] break-all">{item.path}</span>
      </div>
      <span className="text-emerald-400 font-semibold shrink-0 tabular-nums">{item.status}</span>
    </div>
    <p className="text-[#8b949e] break-all">{item.body}</p>
  </div>
);

const ApiShowcaseGroupBlock: React.FC<{ group: ApiShowcaseGroup; t: (key: string) => string }> = ({
  group,
  t,
}) => (
  <div className="space-y-2">
    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8b949e] px-1">
      {t(group.categoryKey)}
    </p>
    {group.items.map((item) => (
      <ApiShowcaseCard key={`${item.method}-${item.path}`} item={item} />
    ))}
  </div>
);

const ShowcaseDescCard: React.FC<{
  iconClass: string;
  icon: string;
  title: string;
  titleClass?: string;
  desc: string;
  href: string;
  linkLabel: string;
}> = ({ iconClass, icon, title, titleClass, desc, href, linkLabel }) => (
  <div className="rounded-xl border border-border bg-card/80 p-5 min-h-[148px] flex gap-3 items-start shrink-0">
    <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconClass}`}>
      <i className={`${icon} text-base`} />
    </span>
    <div className="min-w-0 flex-1">
      <h3 className={`font-semibold ${titleClass ?? ''}`}>{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{desc}</p>
      <a
        href={href}
        className="mt-2 inline-flex items-center gap-1 text-sm text-sky-600 dark:text-sky-400 hover:underline"
      >
        {linkLabel}
        <i className="fas fa-arrow-right text-xs" />
      </a>
    </div>
  </div>
);

const LandingPage: React.FC = () => {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading } = useAuth();
  const baseUrl = useMemo(getApiBaseUrl, []);
  const [quickstartTab, setQuickstartTab] = useState<QuickstartTab>('mcp');
  const [copied, setCopied] = useState<string | null>(null);

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/dashboard/usage" replace />;
  }

  const copyCode = async (text: string, id: string) => {
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const quickstartCode =
    quickstartTab === 'curl' ? curlQuickstart(baseUrl) : mcpQuickstart(baseUrl);

  return (
    <div className="login-shell relative min-h-screen flex flex-col">
      <SEO title={t('seo.landingTitle')} description={t('seo.landingDescription')} />

      <header className="relative z-10 border-b border-sky-200/50 dark:border-border bg-card/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight shrink-0">
            <span className="w-8 h-8 rounded-lg bg-sky-500/15 flex items-center justify-center">
              <i className="fas fa-envelope text-sm text-sky-600 dark:text-sky-400" />
            </span>
            zMailR
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <a
              href="/docs/"
              className="text-sm text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted/50"
            >
              {t('nav.docs')}
            </a>
            <a
              href="https://github.com/jia0327/zmailr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted/50 hidden sm:inline"
            >
              GitHub
            </a>
            <ThemeSwitcher />
            <Link
              to="/login"
              className="text-sm font-medium px-3 py-1.5 rounded-lg text-white bg-sky-600 hover:bg-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400 transition-colors"
            >
              {t('landing.signIn')}
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative flex-1">
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 lg:py-20">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400 mb-4">
                {t('landing.badge')}
              </p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight">
                {t('landing.heroTitle')}
                <span className="text-sky-600 dark:text-sky-400"> {t('landing.heroTitleHighlight')}</span>
              </h1>
              <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl">
                {t('landing.heroSubtitle')}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-white bg-sky-600 hover:bg-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400 shadow-md shadow-sky-600/20 transition-colors"
                >
                  {t('landing.tryDemo')}
                  <i className="fas fa-arrow-right text-sm" />
                </Link>
                <a
                  href="/docs/"
                  className="inline-flex items-center px-5 py-2.5 rounded-lg font-medium border border-border hover:bg-muted/50 transition-colors"
                >
                  {t('landing.readDocs')}
                </a>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{t('landing.tryDemoHint')}</p>
              <div className="mt-8 flex flex-wrap gap-2">
                {WORKS_WITH.map((label) => (
                  <span
                    key={label}
                    className="text-xs px-2.5 py-1 rounded-full border border-border bg-card/60 text-muted-foreground"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-sky-200/70 dark:border-border bg-card shadow-xl shadow-sky-500/10 dark:shadow-black/30 overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 bg-muted/30">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-sm font-mono truncate">signup-8xef@your-domain.com</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{t('landing.mockTtl')}</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="rounded-lg border border-border p-3 bg-background/50">
                  <p className="text-xs text-muted-foreground">{t('landing.mockInbox')}</p>
                  <p className="text-sm font-medium mt-1">{t('landing.mockSubject')}</p>
                </div>
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      {t('landing.mockOtpLabel')}
                    </p>
                    <p className="text-2xl font-mono font-bold tracking-widest mt-1">847291</p>
                  </div>
                  <i className="fas fa-check-circle text-emerald-600 dark:text-emerald-400 text-xl" />
                </div>
                <div className="rounded-md bg-muted/50 px-3 py-2 text-xs font-mono text-muted-foreground">
                  {t('landing.mockApi')}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-card/40">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
            <div className="max-w-2xl">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('landing.quickstartTitle')}</h2>
              <p className="mt-2 text-muted-foreground">{t('landing.quickstartSubtitle')}</p>
            </div>

            <div className="mt-8 rounded-xl border border-border bg-[#0d1117] dark:bg-[#0a0a0a] overflow-hidden shadow-lg">
              <div className="flex items-center gap-1 p-2 border-b border-white/10 bg-white/5">
                {(['mcp', 'curl'] as QuickstartTab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setQuickstartTab(tab)}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      quickstartTab === tab
                        ? 'bg-white/10 text-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab === 'curl' ? t('landing.quickstartTabCurl') : t('landing.quickstartTabMcp')}
                  </button>
                ))}
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => copyCode(quickstartCode, 'quickstart')}
                  className="text-xs px-2 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-white/10"
                >
                  <i className={`fas ${copied === 'quickstart' ? 'fa-check' : 'fa-copy'} mr-1`} />
                  {copied === 'quickstart' ? t('common.copied') : t('tokens.copyOneClick')}
                </button>
              </div>
              <div className="p-4 sm:p-6 text-sm font-mono leading-relaxed text-[#e6edf3] overflow-x-auto">
                <pre className="whitespace-pre-wrap break-words"><code>{quickstartCode}</code></pre>
              </div>
              <div className="border-t border-white/10 px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono bg-black/30">
                <span className="text-emerald-400 font-semibold uppercase tracking-wider shrink-0">
                  {t('landing.quickstartResponse')}
                </span>
                <span className="text-[#8b949e] break-all">{quickstartResponseLine}</span>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <span className="text-sm text-muted-foreground">{t('landing.installMcp')}</span>
              <code className="text-sm font-mono px-3 py-1.5 rounded-lg bg-muted border border-border">
                {t('landing.mcpCommand')}
              </code>
              <button
                type="button"
                onClick={() => copyCode('npx -y @zmailr/mcp', 'mcp')}
                className="text-sm text-sky-600 dark:text-sky-400 hover:underline"
              >
                {copied === 'mcp' ? t('common.copied') : t('tokens.copyOneClick')}
              </button>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="grid lg:grid-cols-2 gap-6 lg:gap-10 lg:items-stretch">
            <div className="flex flex-col gap-6 min-h-0">
              <div
                className={`flex flex-col rounded-xl border border-border bg-[#0d1117] dark:bg-[#0a0a0a] overflow-hidden font-mono text-xs text-[#e6edf3] ${SHOWCASE_PANEL_H}`}
              >
                <div className="px-4 py-2 border-b border-white/10 bg-white/5 text-[11px] font-semibold uppercase tracking-wider text-[#8b949e] shrink-0">
                  {t('landing.showcaseInboxFeed')}
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                        {t('landing.showcaseDelivered')}
                      </span>
                      <span className="text-[#8b949e] tabular-nums">14:23:01</span>
                    </div>
                    <p className="text-[#8b949e]">
                      {t('landing.showcaseTo')}{' '}
                      <span className="text-[#e6edf3]">signup-k8m2@your-domain.com</span>
                    </p>
                    <p className="text-[#8b949e]">
                      {t('landing.showcaseFrom')}{' '}
                      <span className="text-[#e6edf3]">noreply@stripe.com</span>
                    </p>
                    <div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 flex items-center justify-between">
                      <span className="text-emerald-300 font-semibold">{t('landing.showcaseOtp')}</span>
                      <span className="text-lg font-bold tracking-widest text-[#e6edf3]">847291</span>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-white/10 pt-4">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                        {t('landing.showcaseDelivered')}
                      </span>
                      <span className="text-[#8b949e] tabular-nums">14:22:48</span>
                    </div>
                    <p className="text-[#8b949e]">
                      {t('landing.showcaseTo')}{' '}
                      <span className="text-[#e6edf3]">test-r4n9@your-domain.com</span>
                    </p>
                    <p className="text-[#8b949e]">
                      {t('landing.showcaseFrom')}{' '}
                      <span className="text-[#e6edf3]">team@github.com</span>
                    </p>
                    <div className="mt-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2">
                      <span className="text-sky-300 font-semibold">{t('landing.showcaseLink')}</span>
                      <p className="mt-1 text-[11px] text-[#8b949e] truncate">
                        https://github.com/login/verify?t=…
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-white/10 pt-4">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">
                        {t('landing.showcasePending')}
                      </span>
                      <span className="text-[#8b949e] tabular-nums">14:22:32</span>
                    </div>
                    <p className="text-[#8b949e]">
                      {t('landing.showcaseTo')}{' '}
                      <span className="text-[#e6edf3]">wait-3f2a@your-domain.com</span>
                    </p>
                  </div>
                </div>
              </div>
              <ShowcaseDescCard
                iconClass="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                icon="fas fa-envelope"
                title={t('landing.showcaseRealMxTitle')}
                titleClass="text-emerald-600 dark:text-emerald-400"
                desc={t('landing.showcaseRealMxDesc')}
                href="/docs/"
                linkLabel={t('landing.showcaseLearnMore')}
              />
            </div>

            <div className="flex flex-col gap-6 min-h-0">
              <div
                className={`flex flex-col rounded-xl border border-border bg-[#0d1117] dark:bg-[#0a0a0a] overflow-hidden font-mono text-xs text-[#e6edf3] ${SHOWCASE_PANEL_H}`}
              >
                <div className="px-4 py-2 border-b border-white/10 bg-white/5 text-[11px] font-semibold uppercase tracking-wider text-[#8b949e] shrink-0">
                  {t('landing.showcaseRestApi')} · {t('landing.showcaseMcpTools')}
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-5 min-h-0">
                  {LANDING_REST_API_GROUPS.map((group) => (
                    <ApiShowcaseGroupBlock key={group.categoryKey} group={group} t={t} />
                  ))}
                  <div className="border-t border-white/10 pt-4">
                    {LANDING_MCP_GROUPS.map((group) => (
                      <ApiShowcaseGroupBlock key={group.categoryKey} group={group} t={t} />
                    ))}
                  </div>
                </div>
              </div>
              <ShowcaseDescCard
                iconClass="bg-amber-500/15 text-amber-600 dark:text-amber-400"
                icon="fas fa-code"
                title={t('landing.showcaseJsonTitle')}
                desc={t('landing.showcaseJsonDesc')}
                href="/docs/api.html"
                linkLabel={t('landing.showcaseReadDocs')}
              />
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-card/40">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
            <div className="max-w-2xl">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('landing.featuresTitle')}</h2>
              <p className="mt-2 text-muted-foreground">{t('landing.featuresSubtitle')}</p>
            </div>
            <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {FEATURES.map(({ icon, titleKey, descKey }) => (
                <div
                  key={titleKey}
                  className="rounded-xl border border-border p-4 sm:p-5 bg-card hover:border-sky-300/50 dark:hover:border-sky-500/30 transition-colors"
                >
                  <span className="w-9 h-9 rounded-lg bg-sky-500/15 flex items-center justify-center">
                    <i className={`${icon} text-sm text-sky-600 dark:text-sky-400`} />
                  </span>
                  <h3 className="mt-3 font-semibold text-sm sm:text-base">{t(titleKey)}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{t(descKey)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-border py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} zMailR</span>
          <div className="flex items-center gap-4">
            <a href="/docs/" className="hover:text-foreground transition-colors">{t('landing.footerDocs')}</a>
            <a href="/docs/api.html" className="hover:text-foreground transition-colors">{t('landing.footerApi')}</a>
            <a
              href="https://github.com/jia0327/zmailr"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              {t('landing.footerGithub')}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
