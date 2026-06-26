import React from 'react';
import { useTranslation } from 'react-i18next';

const ApiUsageDocs: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="border border-border rounded-lg bg-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold">{t('apiUsage.title')}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">{t('apiUsage.docsLinkHint')}</p>
      </div>
      <a
        href="/docs/api-interactive.html"
        className="inline-flex items-center justify-center shrink-0 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {t('apiUsage.viewFullApiDocs')}
      </a>
    </div>
  );
};

export default ApiUsageDocs;
