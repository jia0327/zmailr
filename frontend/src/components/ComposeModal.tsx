import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { sendUserEmail } from '../utils/api';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultFrom?: string;
  onSent?: () => void;
}

const ComposeModal: React.FC<ComposeModalProps> = ({ isOpen, onClose, defaultFrom, onSent }) => {
  const { t } = useTranslation();
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [from, setFrom] = useState(defaultFrom || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (defaultFrom) setFrom(defaultFrom);
  }, [defaultFrom]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await sendUserEmail({
      to,
      subject,
      text,
      from: from || undefined,
    });
    setLoading(false);
    if (result.success) {
      setTo('');
      setSubject('');
      setText('');
      onSent?.();
      onClose();
    } else {
      setError(result.error || t('send.failed'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background border rounded-lg w-full max-w-lg p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">{t('send.title')}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div>
            <label className="text-sm font-medium">{t('send.to')}</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm mt-1"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('send.from')}</label>
            <input
              type="text"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder={t('send.fromPlaceholder')}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('send.subject')}</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm mt-1"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t('send.body')}</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 border rounded-md bg-background text-sm mt-1"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-md hover:bg-muted">
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md disabled:opacity-50"
            >
              {loading ? t('common.loading') : t('send.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ComposeModal;
