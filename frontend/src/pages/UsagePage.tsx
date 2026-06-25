import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DashboardPageHeader from '../components/DashboardPageHeader';
import StatCard from '../components/StatCard';
import { useAuth } from '../contexts/AuthContext';

const SCOPE_I18N: Record<string, string> = {
  lease: 'tokens.scopeLease',
  mail: 'tokens.scopeMail',
  send: 'tokens.scopeSend',
};

const fmtTime = (ts: number) => new Date(ts > 1e12 ? ts : ts * 1000).toLocaleString();

const UsagePage: React.FC = () => {
  const { t } = useTranslation();
  const { user, usage, stats, refresh } = useAuth();

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

  const token = stats?.token ?? null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <DashboardPageHeader
        breadcrumb={t('dashboard.breadcrumbUsage')}
        title={t('dashboard.usageTitle')}
        subtitle={t('dashboard.usageSubtitle')}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
          label={t('dashboard.messagesReceived')}
          value={stats?.messagesReceivedCount ?? 0}
          icon="fas fa-inbox"
          hint={t('dashboard.messagesReceivedHint')}
        />
        <StatCard
          label={t('dashboard.customRulesCount')}
          value={stats?.customRulesCount ?? 0}
          icon="fas fa-filter"
          hint={t('dashboard.customRulesCountHint')}
        />
        <StatCard
          label={t('dashboard.usedToday')}
          value={sendCount}
          icon="fas fa-chart-line"
          hint={t('dashboard.usedTodayHint')}
        />
      </div>

      <div className="border rounded-lg p-4 bg-card space-y-2">
        <h2 className="font-semibold">{t('auth.profile')}</h2>
        <p className="text-sm">
          <span className="text-muted-foreground">{t('auth.username')}:</span>{' '}
          {user?.username ?? '—'}
        </p>
        <p className="text-sm">
          <span className="text-muted-foreground">{t('auth.role')}:</span>{' '}
          {user?.role ?? '—'}
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

      <div className="border rounded-lg p-4 bg-card space-y-3">
        <h2 className="font-semibold">{t('dashboard.tokenInfo')}</h2>
        {token ? (
          <div className="text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">{t('tokens.nameLabel')}:</span>{' '}
              <span className="font-medium">{token.name || `#${token.id}`}</span>
            </p>
            <p>
              <span className="text-muted-foreground">{t('tokens.permissionsLabel')}:</span>{' '}
              {token.scopes
                .map((s) => (SCOPE_I18N[s] ? t(SCOPE_I18N[s]) : s))
                .join(', ')}
            </p>
            <p>
              <span className="text-muted-foreground">{t('tokens.expiresAtLabel')}:</span>{' '}
              {fmtTime(token.expiresAt)}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('dashboard.noToken')}{' '}
            <Link to="/dashboard/api-keys" className="text-primary hover:underline">
              {t('dashboard.apiKeys')}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
};

export default UsagePage;
