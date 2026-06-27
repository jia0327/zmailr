import React, { useState, useRef, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { deleteMailbox as apiDeleteMailbox } from '../utils/api';
import { MailboxContext } from '../contexts/MailboxContext';
import {
  formatMailboxDisplayEmail,
  getMailboxLocalPart,
  isSameMailbox,
  mailboxIdentityKey,
} from '../utils/mailbox';

interface MailboxSwitcherProps {
  currentMailbox: Mailbox;
  onSwitchMailbox: (mailbox: Mailbox) => void;
  domain: string;
}

const MailboxSwitcher: React.FC<MailboxSwitcherProps> = ({
  currentMailbox,
  onSwitchMailbox,
  domain,
}) => {
  const { t } = useTranslation();
  const { showSuccessMessage, showErrorMessage } = useContext(MailboxContext);
  const [savedMailboxes, setSavedMailboxes] = useState<Mailbox[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSavedMailboxes();
  }, []);

  useEffect(() => {
    if (currentMailbox) {
      updateSavedMailboxes(currentMailbox);
    }
  }, [currentMailbox]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const loadSavedMailboxes = () => {
    try {
      const savedData = localStorage.getItem('savedMailboxes');
      if (savedData) {
        const mailboxes = JSON.parse(savedData) as Mailbox[];
        const now = Date.now() / 1000;
        const validMailboxes = mailboxes.filter(m => m.expiresAt > now);
        setSavedMailboxes(validMailboxes);
      }
    } catch (error) {
      console.error('Error loading saved mailboxes:', error);
    }
  };

  const updateSavedMailboxes = (mailbox: Mailbox) => {
    try {
      const now = Date.now() / 1000;

      let mailboxes: Mailbox[] = [];
      try {
        const savedData = localStorage.getItem('savedMailboxes');
        if (savedData) {
          mailboxes = JSON.parse(savedData) as Mailbox[];
        }
      } catch (error) {
        console.error('Error parsing saved mailboxes:', error);
      }

      mailboxes = mailboxes.filter(m => m.expiresAt > now);

      const mailboxIndex = mailboxes.findIndex(m => isSameMailbox(m, mailbox, domain));

      if (mailboxIndex >= 0) {
        mailboxes[mailboxIndex] = mailbox;
      } else {
        mailboxes.push(mailbox);
      }

      setSavedMailboxes(mailboxes);
      localStorage.setItem('savedMailboxes', JSON.stringify(mailboxes));
    } catch (error) {
      console.error('Error updating saved mailboxes:', error);
    }
  };

  const handleSwitchMailbox = (mailbox: Mailbox) => {
    onSwitchMailbox(mailbox);
    setShowDropdown(false);
    showSuccessMessage(t('mailbox.switchSuccess'));
  };

  const handleDeleteMailbox = async (mailbox: Mailbox) => {
    if (window.confirm(t('mailbox.confirmDeleteMailbox'))) {
      const address = getMailboxLocalPart(mailbox.address);
      const result = await apiDeleteMailbox(address);
      if (result.success) {
        const updatedMailboxes = savedMailboxes.filter(m => !isSameMailbox(m, mailbox, domain));
        setSavedMailboxes(updatedMailboxes);
        localStorage.setItem('savedMailboxes', JSON.stringify(updatedMailboxes));
        showSuccessMessage(t('mailbox.deleteSavedSuccess'));
      } else {
        showErrorMessage(t('mailbox.deleteFailed'));
      }
    }
  };

  const handleClearAllMailboxes = async () => {
    if (window.confirm(t('mailbox.confirmClearAllMailboxes'))) {
      const mailboxesToDelete = savedMailboxes.filter(
        m => !isSameMailbox(m, currentMailbox, domain)
      );

      if (mailboxesToDelete.length === 0) {
        setShowDropdown(false);
        return;
      }

      const deletePromises = mailboxesToDelete.map(m =>
        apiDeleteMailbox(getMailboxLocalPart(m.address))
      );
      const results = await Promise.allSettled(deletePromises);

      const currentMailboxToKeep = savedMailboxes.find(m =>
        isSameMailbox(m, currentMailbox, domain)
      );
      const mailboxesToKeep = currentMailboxToKeep ? [currentMailboxToKeep] : [];

      setSavedMailboxes(mailboxesToKeep);
      localStorage.setItem('savedMailboxes', JSON.stringify(mailboxesToKeep));
      setShowDropdown(false);

      const failedCount = results.filter(r => r.status === 'rejected').length;
      if (failedCount > 0) {
        showErrorMessage(t('mailbox.clearAllFailed', { count: failedCount }));
      } else {
        showSuccessMessage(t('mailbox.clearAllSuccess'));
      }
    }
  };

  if (savedMailboxes.length <= 1) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="h-full px-3 py-2.5 hover:bg-muted transition-colors"
        aria-label={t('mailbox.switch')}
        title={t('mailbox.switch')}
      >
        <i className="fas fa-exchange-alt text-sm"></i>
      </button>

      {showDropdown && (
        <div className="absolute top-9 left-0 bg-popover text-popover-foreground border rounded-md shadow-lg p-1 z-20 min-w-[250px]">
          <div className="text-xs font-medium px-2 py-1 text-muted-foreground flex justify-between items-center">
            {t('mailbox.savedMailboxes')}
            <button
              onClick={handleClearAllMailboxes}
              className="text-red-500 hover:text-red-700 text-xs"
              title={t('mailbox.clearAll')}
            >
              <i className="fas fa-trash-alt mr-1"></i>
              {t('mailbox.clearAll')}
            </button>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {savedMailboxes.map((m) => {
              const displayEmail = formatMailboxDisplayEmail(m, domain);
              const isCurrent = isSameMailbox(m, currentMailbox, domain);
              return (
                <div
                  key={mailboxIdentityKey(m, domain)}
                  className="flex items-center justify-between hover:bg-muted rounded-sm"
                >
                  <button
                    onClick={() => handleSwitchMailbox(m)}
                    className={`w-full text-left text-sm px-2 py-1.5 transition-colors truncate ${
                      isCurrent ? 'bg-primary/10 text-primary font-medium' : ''
                    }`}
                  >
                    {displayEmail}
                  </button>
                  {!isCurrent && (
                    <button
                      onClick={() => handleDeleteMailbox(m)}
                      className="p-2 text-red-500 hover:text-red-700"
                      title={t('common.delete')}
                    >
                      <i className="fas fa-trash-alt text-xs"></i>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MailboxSwitcher;
