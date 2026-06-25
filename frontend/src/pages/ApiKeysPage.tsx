import React from 'react';
import { useTranslation } from 'react-i18next';
import ApiTokenManager from '../components/ApiTokenManager';
import ApiUsageDocs from '../components/ApiUsageDocs';
import DashboardPageHeader from '../components/DashboardPageHeader';
import { useAuth } from '../contexts/AuthContext';

const ApiKeysPage: React.FC = () => {
  const { t } = useTranslation();
  const { stats, isLoading } = useAuth();
  const autoOpenCreate = !isLoading && !stats?.token;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <DashboardPageHeader
        breadcrumb={t('dashboard.breadcrumbApiKeys')}
        title={t('dashboard.apiKeysTitle')}
        subtitle={t('dashboard.apiKeysSubtitle')}
      />
      <ApiTokenManager autoOpenCreate={autoOpenCreate} />
      <ApiUsageDocs />
    </div>
  );
};

export default ApiKeysPage;
