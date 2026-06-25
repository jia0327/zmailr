import React, { useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { createUserMailbox } from '../utils/api';
import MailboxSwitcher from './MailboxSwitcher';
import { MailboxContext } from '../contexts/MailboxContext';

interface HeaderMailboxProps {
  mailbox: Mailbox | null;
  onMailboxChange: (mailbox: Mailbox) => void;
  domain: string;
  domains: string[];
  isLoading: boolean;
}

const HeaderMailbox: React.FC<HeaderMailboxProps> = ({
  mailbox,
  onMailboxChange,
  domain,
  domains,
  isLoading
}) => {
  const { t } = useTranslation();
  const { showSuccessMessage, showErrorMessage } = useContext(MailboxContext);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customAddress, setCustomAddress] = useState('');
  const [selectedDomain, setSelectedDomain] = useState(domain);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [customAddressError, setCustomAddressError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedDomain(domain);
  }, [domain]);

  if (!mailbox || isLoading) return null;

  const fullAddress = mailbox.address.includes('@')
    ? mailbox.address
    : `${mailbox.address}@${selectedDomain}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(fullAddress)
      .then(() => showSuccessMessage(t('mailbox.copySuccess')))
      .catch(() => showErrorMessage(t('mailbox.copyFailed')));
  };

  const handleRefreshMailbox = async () => {
    setIsActionLoading(true);
    const result = await createUserMailbox();
    setIsActionLoading(false);

    if (result.success && result.mailbox) {
      onMailboxChange(result.mailbox);
      showSuccessMessage(t('mailbox.refreshSuccess'));
    } else {
      showErrorMessage(t('mailbox.refreshFailed'));
    }
  };

  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomAddressError(null);

    if (!customAddress.trim()) {
      setCustomAddressError(t('mailbox.invalidAddress'));
      return;
    }

    setIsActionLoading(true);
    const result = await createUserMailbox(customAddress.trim());
    setIsActionLoading(false);

    if (result.success && result.mailbox) {
      onMailboxChange(result.mailbox);
      showSuccessMessage(t('mailbox.createSuccess'));
      setTimeout(() => {
        setIsCustomMode(false);
        setCustomAddress('');
      }, 1500);
    } else {
      const isAddressExistsError = result.error === 'Address already exists';
      if (isAddressExistsError) {
        setCustomAddressError(t('mailbox.addressExists'));
      } else {
        showErrorMessage(t('mailbox.createFailed'));
      }
    }
  };

  const handleCancelCustom = () => {
    setIsCustomMode(false);
    setCustomAddress('');
    setCustomAddressError(null);
  };

  const handleDomainChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDomain(e.target.value);
    await handleRefreshMailbox();
  };

  const actionBtnClass =
    'inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border bg-background hover:bg-muted transition-colors disabled:opacity-50';

  if (isCustomMode) {
    return (
      <form onSubmit={handleCreateCustom} className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 min-w-[200px] items-stretch">
            <input
              type="text"
              value={customAddress}
              onChange={(e) => {
                setCustomAddress(e.target.value);
                if (customAddressError) setCustomAddressError(null);
              }}
              className={`flex-1 min-w-0 px-3 py-2 text-sm font-mono border rounded-l-md bg-background focus:outline-none focus:ring-1 focus:ring-ring ${
                customAddressError ? 'border-destructive' : ''
              }`}
              placeholder={t('mailbox.customAddressPlaceholder')}
              disabled={isActionLoading}
              autoFocus
            />
            <span className="flex items-center px-2 text-sm border-y border-r rounded-r-md bg-muted font-mono">
              @
              <div className="relative">
                <select
                  value={selectedDomain}
                  onChange={handleDomainChange}
                  className="appearance-none bg-transparent border-none focus:outline-none pl-1 pr-5"
                >
                  {domains.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <i className="fas fa-chevron-down absolute right-0 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none"></i>
              </div>
            </span>
          </div>
          <button type="button" onClick={handleCancelCustom} className={actionBtnClass} disabled={isActionLoading}>
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            className={`${actionBtnClass} bg-primary text-primary-foreground border-primary hover:bg-primary/90`}
            disabled={isActionLoading}
          >
            {isActionLoading ? t('common.loading') : t('common.create')}
          </button>
        </div>
        {customAddressError && (
          <p className="text-destructive text-xs">{customAddressError}</p>
        )}
      </form>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
      <div className="flex flex-1 min-w-0 items-stretch border rounded-md bg-background overflow-hidden">
        <div className="flex-1 min-w-0 flex items-center px-3 py-2.5 overflow-hidden">
          <span className="font-mono text-base sm:text-lg font-medium truncate select-all">
            {mailbox.address}@
            <span className="relative inline-block">
              <select
                value={selectedDomain}
                onChange={handleDomainChange}
                className="appearance-none bg-transparent border-none focus:outline-none font-mono font-medium pr-4 cursor-pointer"
              >
                {domains.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <i className="fas fa-chevron-down absolute right-0 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none"></i>
            </span>
          </span>
        </div>

        <div className="flex items-center border-l shrink-0">
          <MailboxSwitcher
            currentMailbox={mailbox}
            onSwitchMailbox={onMailboxChange}
            domain={selectedDomain}
          />
          <button
            onClick={copyToClipboard}
            className="h-full px-3 py-2.5 hover:bg-muted transition-colors border-l"
            aria-label={t('common.copy')}
            title={t('common.copy')}
          >
            <i className="fas fa-copy text-sm"></i>
          </button>
          <button
            onClick={handleRefreshMailbox}
            className="h-full px-3 py-2.5 hover:bg-muted transition-colors border-l"
            disabled={isActionLoading}
            title={t('mailbox.refresh')}
          >
            <i className={`fas fa-sync-alt text-sm ${isActionLoading ? 'animate-spin' : ''}`}></i>
          </button>
          <button
            onClick={() => setIsCustomMode(true)}
            className="h-full px-3 py-2.5 hover:bg-muted transition-colors border-l"
            disabled={isActionLoading}
            title={t('mailbox.customize')}
          >
            <i className="fas fa-edit text-sm"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default HeaderMailbox;
