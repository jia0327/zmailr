import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ComposeForm from './ComposeForm';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultFrom?: string;
  onSent?: () => void;
}

const ComposeModal: React.FC<ComposeModalProps> = ({ isOpen, onClose, defaultFrom, onSent }) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background border rounded-lg w-full max-w-lg p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{t('send.title')}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <i className="fas fa-times" />
          </button>
        </div>
        <ComposeForm
          defaultFrom={defaultFrom}
          onSent={() => {
            onSent?.();
            onClose();
          }}
        />
      </div>
    </div>
  );
};

export default ComposeModal;
