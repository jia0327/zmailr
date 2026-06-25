import React from 'react';
import { useTranslation } from 'react-i18next';
import DashboardPageHeader from '../components/DashboardPageHeader';
import StatCard from '../components/StatCard';
import { useAuth } from '../contexts/AuthContext';

const UsagePage: React.FC = () => {
  const { t } = useTranslation();
  const { user, usage, refresh } = useAuth();

  const quota = user?.dailySendQuota ?? 0;
  const sendCount = usage?.sendCount ?? 0;
  const leaseCount = usage?.leaseCount ?? 0;
  const remaining = usage?.sendRemaining ?? user?.sendRemaining;

  const quotaLabel = quota < 0 ? t('auth.unlimited') : String(quota);
  const remainingLabel = remaining === undefined
    ? '—'
    : remaining < 0
      ? t('auth.unlimited')
      : String(remaining);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <DashboardPageHeader
        breadcrumb={t('dashboard.breadcrumbUsage')}
        title={t('dashboard.usageTitle')}
        subtitle={t('dashboard.usageSubtitle')}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          label={t('auth.dailyQuota')}
          value={quotaLabel}
          icon="fas fa-paper-plane"
          hint={`${t('dashboard.usedToday')}: ${sendCount}`}
        />
        <StatCard
          label={t('dashboard.statRemaining')}
          value={remainingLabel}
          icon="fas fa-hourglass-half"
        />
        <StatCard
          label={t('dashboard.leaseCount')}
          value={leaseCount}
          icon="fas fa-envelope-open"
          hint={t('dashboard.leaseCountHint')}
        />
        <StatCard
          label={t('auth.role')}
          value={user?.role ?? '—'}
          icon="fas fa-user"
        />
      </div>

      <div className="border rounded-lg p-4 bg-card space-y-2">
        <h2 className="font-semibold">{t('auth.profile')}</h2>
        <p className="text-sm">
          <span className="text-muted-foreground">{t('auth.username')}:</span>{' '}
          {user?.username}
        </p>
        {usage?.usageDate && (
          <p className="text-sm">
            <span className="text-muted-foreground">{t('dashboard.usageDate')}:</span>{' '}
            {usage.usageDate}
          </p>
        )}
        <button
          onClick={refresh}
          className="text-sm text-primary hover:underline mt-2"
        >
          {t('common.refresh')}
        </button>
      </div>
    </div>
  );
};

export default UsagePage;
