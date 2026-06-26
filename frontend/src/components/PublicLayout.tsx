import React from 'react';
import { Link, Outlet, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Container from './Container';
import SEO from './SEO';
import ThemeSwitcher from './ThemeSwitcher';
import { useAuth } from '../contexts/AuthContext';

const PublicLayout: React.FC = () => {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const embed = searchParams.get('embed') === '1';

  if (embed) {
    return (
      <div className="min-h-0 bg-background text-foreground">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SEO title={t('seo.publicTitle')} description={t('seo.description')} />
      <header className="border-b">
        <Container className="py-3">
          <div className="flex items-center justify-between gap-4">
            <Link to={isAuthenticated ? '/dashboard/usage' : '/login'} className="text-lg font-bold tracking-tight">
              {t('app.title')}
            </Link>
            <div className="flex items-center gap-2">
              <a href="/docs/" className="text-sm text-muted-foreground hover:text-foreground">
                {t('nav.docs')}
              </a>
              {isAuthenticated ? (
                <Link to="/dashboard/usage" className="text-sm text-muted-foreground hover:text-foreground">
                  {t('dashboard.usage')}
                </Link>
              ) : (
                <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
                  {t('auth.login')}
                </Link>
              )}
              <ThemeSwitcher />
            </div>
          </div>
        </Container>
      </header>
      <main className="flex-1 py-6">
        <Outlet />
      </main>
    </div>
  );
};

export default PublicLayout;
