import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher';
import HeaderMailbox from './HeaderMailbox';
import Container from './Container';
import { getEmailDomains, getDefaultEmailDomain, EMAIL_DOMAINS, DEFAULT_EMAIL_DOMAIN } from '../config';
import ThemeSwitcher from './ThemeSwitcher';

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
  const [emailDomains, setEmailDomains] = useState<string[]>(EMAIL_DOMAINS);
  const [defaultDomain, setDefaultDomain] = useState<string>(DEFAULT_EMAIL_DOMAIN);

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
        <div className="flex items-center justify-between py-3">
          <Link to="/" className="text-xl font-bold tracking-tight">
            {t('app.title')}
          </Link>

          <div className="flex items-center gap-1">
            <ThemeSwitcher />
            <LanguageSwitcher />
            <a
              href="https://momobako.xx.kg/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 flex items-center justify-center rounded-md transition-colors hover:bg-muted"
              aria-label="GitHub"
              title="aki nav"
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
    </header>
  );
};

export default Header;
