import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import HeaderMailbox from './HeaderMailbox';
import ComposeModal from './ComposeModal';
import Container from './Container';
import { getEmailDomains, getDefaultEmailDomain, EMAIL_DOMAINS, DEFAULT_EMAIL_DOMAIN, formatMailboxEmail } from '../config';
import ThemeSwitcher from './ThemeSwitcher';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  mailbox: Mailbox | null;
  onMailboxChange?: (mailbox: Mailbox) => void;
  isLoading?: boolean;
}

const Header: React.FC<HeaderProps> = ({
  mailbox = null,
  onMailboxChange = () => {},
  isLoading = false
}) => {
  const { t } = useTranslation();
  const location = useLocation();
  const { isAuthenticated, refresh } = useAuth();
  const [emailDomains, setEmailDomains] = useState<string[]>(EMAIL_DOMAINS);
  const [defaultDomain, setDefaultDomain] = useState<string>(DEFAULT_EMAIL_DOMAIN);
  const [composeOpen, setComposeOpen] = useState(false);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const domains = await getEmailDomains();
        const defaultDom = await getDefaultEmailDomain();
        setEmailDomains(domains);
        setDefaultDomain(defaultDom);
      } catch (error) {
        console.error('加载邮箱域名配置失败:', error);
      }
    };

    loadConfig();
  }, []);

  return (
    <header className="border-b">
      <Container>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-3">
          <div className="flex items-center gap-3">
            <a
              href="/docs/"
              className="text-sm transition-colors hover:text-foreground text-muted-foreground"
            >
              {t('nav.docs')}
            </a>
            <a
              href="/docs/api-interactive.html"
              className="text-sm transition-colors hover:text-foreground text-muted-foreground"
            >
              {t('nav.api')}
            </a>
          </div>

          <Link
            to="/"
            className="text-base sm:text-xl font-bold tracking-tight text-center whitespace-nowrap"
          >
            {t('app.title')}
          </Link>

          <div className="flex items-center justify-end gap-1">
            {isAuthenticated ? (
              <>
                <button
                  onClick={() => setComposeOpen(true)}
                  className="text-sm px-2 py-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                  title={t('send.title')}
                >
                  <i className="fas fa-paper-plane mr-1"></i>
                  <span className="hidden sm:inline">{t('send.title')}</span>
                </button>
                <Link
                  to="/account"
                  className={`text-sm px-2 py-1 rounded-md transition-colors hover:bg-muted ${
                    location.pathname === '/account' ? 'text-foreground font-medium' : 'text-muted-foreground'
                  }`}
                >
                  {t('auth.account')}
                </Link>
              </>
            ) : (
              <Link
                to="/login"
                className={`text-sm px-2 py-1 rounded-md transition-colors hover:bg-muted ${
                  location.pathname === '/login' ? 'text-foreground font-medium' : 'text-muted-foreground'
                }`}
              >
                {t('auth.login')}
              </Link>
            )}
            <ThemeSwitcher />
            <a
              href="https://github.com/jia0327/zmailr"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 flex items-center justify-center rounded-md transition-colors hover:bg-muted"
              aria-label="GitHub"
              title="GitHub"
            >
              <i className="fab fa-github text-base"></i>
            </a>
          </div>
        </div>
      </Container>

      {mailbox && (
        <div className="border-t bg-muted/20">
          <Container className="py-3">
            <HeaderMailbox
              mailbox={mailbox}
              onMailboxChange={onMailboxChange}
              domain={defaultDomain}
              domains={emailDomains}
              isLoading={isLoading}
            />
          </Container>
        </div>
      )}

      <ComposeModal
        isOpen={composeOpen && isAuthenticated}
        onClose={() => setComposeOpen(false)}
        defaultFrom={mailbox ? formatMailboxEmail(mailbox, defaultDomain) : undefined}
        onSent={refresh}
      />
    </header>
  );
};

export default Header;
