import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { sendUserEmail } from '../utils/api';

interface ComposeFormProps {
  defaultFrom?: string;
  onSent?: () => void;
  className?: string;
}

const ComposeForm: React.FC<ComposeFormProps> = ({ defaultFrom, onSent, className = '' }) => {
  const { t } = useTranslation();
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [from, setFrom] = useState(defaultFrom || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  React.useEffect(() => {
    if (defaultFrom) setFrom(defaultFrom);
  }, [defaultFrom]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
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
      setSuccess(true);
      onSent?.();
    } else {
      setError(result.error || t('send.failed'));
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-3 ${className}`}>
      {error && <p className="text-destructive text-sm">{error}</p>}
      {success && <p className="text-sm text-green-600 dark:text-green-400">{t('send.success')}</p>}
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
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md disabled:opacity-50 hover:bg-primary/90"
      >
        {loading ? t('common.loading') : t('send.submit')}
      </button>
    </form>
  );
};

export default ComposeForm;
