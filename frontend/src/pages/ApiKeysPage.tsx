import React from 'react';
import { useTranslation } from 'react-i18next';
import ApiTokenManager from '../components/ApiTokenManager';
import DashboardPageHeader from '../components/DashboardPageHeader';

const ApiKeysPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <DashboardPageHeader
        breadcrumb={t('dashboard.breadcrumbApiKeys')}
        title={t('dashboard.apiKeysTitle')}
        subtitle={t('dashboard.apiKeysSubtitle')}
      />
      <ApiTokenManager />
    </div>
  );
};

export default ApiKeysPage;
