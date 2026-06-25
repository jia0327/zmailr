import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import EmailList from '../components/EmailList';
import HeaderMailbox from '../components/HeaderMailbox';
import DashboardPageHeader from '../components/DashboardPageHeader';
import StatCard from '../components/StatCard';
import MailboxHistoryList from '../components/MailboxHistoryList';
import { MailboxContext } from '../contexts/MailboxContext';
import { getEmailDomains, getDefaultEmailDomain, EMAIL_DOMAINS, DEFAULT_EMAIL_DOMAIN } from '../config';
import { UserMailboxItem } from '../utils/api';

const InboxPage: React.FC = () => {
  const { t } = useTranslation();
  const {
    mailbox,
    setMailbox,
    switchToMailbox,
    isLoading,
    emails,
    selectedEmail,
    setSelectedEmail,
    isEmailsLoading,
    createNewMailbox,
    showSuccessMessage,
  } = useContext(MailboxContext);

  const [emailDomains, setEmailDomains] = React.useState<string[]>(EMAIL_DOMAINS);
  const [defaultDomain, setDefaultDomain] = React.useState<string>(DEFAULT_EMAIL_DOMAIN);
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => {
    const loadConfig = async () => {
      try {
        const domains = await getEmailDomains();
        const defaultDom = await getDefaultEmailDomain();
        setEmailDomains(domains);
        setDefaultDomain(defaultDom);
      } catch (error) {
        console.error('Failed to load email domains:', error);
      }
    };
    loadConfig();
  }, []);

  const calculateTimeLeft = (expiresAt: number) => {
    if (!expiresAt) return '—';
    const now = Math.floor(Date.now() / 1000);
    const timeLeftSeconds = expiresAt - now;
    if (timeLeftSeconds <= 0) return t('mailbox.expired');
    const hours = Math.floor(timeLeftSeconds / 3600);
    const minutes = Math.floor((timeLeftSeconds % 3600) / 60);
    if (hours > 0) return t('mailbox.expiresInTime', { hours, minutes });
    return t('mailbox.expiresInMinutes', { minutes });
  };

  const handleSelectHistoryMailbox = (mb: UserMailboxItem) => {
    switchToMailbox({
      id: mb.id,
      address: mb.address,
      createdAt: mb.createdAt,
      expiresAt: mb.expiresAt,
      ipAddress: mb.ipAddress,
      lastAccessed: mb.lastAccessed,
    });
  };

  const handleReactivated = (mb: UserMailboxItem) => {
    switchToMailbox({
      id: mb.id,
      address: mb.address,
      createdAt: mb.createdAt,
      expiresAt: mb.expiresAt,
      ipAddress: mb.ipAddress,
      lastAccessed: mb.lastAccessed,
    });
    showSuccessMessage(t('history.reactivateSuccess'));
  };

  const handleHistoryDeleted = (address: string) => {
    if (mailbox?.address === address) {
      createNewMailbox();
    }
  };

  const handleNewInbox = async () => {
    setCreating(true);
    try {
      await createNewMailbox();
    } finally {
      setCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-muted-foreground/20 border-t-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <DashboardPageHeader
        breadcrumb={t('dashboard.breadcrumbInbox')}
        title={t('dashboard.inboxTitle')}
        subtitle={t('dashboard.inboxSubtitle')}
        action={
          <button
            onClick={handleNewInbox}
            disabled={creating}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <i className={`fas fa-plus ${creating ? 'animate-spin' : ''}`} />
            {t('dashboard.newInbox')}
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label={t('dashboard.statActiveMailbox')}
          value={mailbox ? 1 : 0}
          icon="fas fa-envelope"
        />
        <StatCard
          label={t('dashboard.statMessages')}
          value={emails.length}
          icon="fas fa-inbox"
          hint={t('dashboard.statMessagesHint')}
        />
        <StatCard
          label={t('dashboard.statTtl')}
          value={mailbox ? calculateTimeLeft(mailbox.expiresAt) : '—'}
          icon="fas fa-clock"
          hint={t('dashboard.statTtlHint')}
        />
      </div>

      {mailbox && (
        <div className="border rounded-lg p-4 bg-card">
          <HeaderMailbox
            mailbox={mailbox}
            onMailboxChange={setMailbox}
            domain={defaultDomain}
            domains={emailDomains}
            isLoading={isLoading}
          />
        </div>
      )}

      <MailboxHistoryList
        activeAddress={mailbox?.address}
        onSelect={handleSelectHistoryMailbox}
        onReactivated={handleReactivated}
        onDeleted={handleHistoryDeleted}
      />

      <EmailList
        emails={emails}
        selectedEmailId={selectedEmail}
        onSelectEmail={setSelectedEmail}
        isLoading={isEmailsLoading}
      />
    </div>
  );
};

export default InboxPage;
