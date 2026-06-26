import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { sendUserEmail, SendAttachmentItem } from '../utils/api';
import {
  getInlineDataUrlBytes,
  isQuillEmpty,
  MAX_INLINE_IMAGES_TOTAL,
  stripHtmlToText,
} from '../utils/htmlBody';
import RichTextEditor from './RichTextEditor';

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

interface ComposeFormProps {
  defaultFrom?: string;
  onSent?: () => void;
  className?: string;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const ComposeForm: React.FC<ComposeFormProps> = ({ defaultFrom, onSent, className = '' }) => {
  const { t } = useTranslation();
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [html, setHtml] = useState('');
  const [bodyMode, setBodyMode] = useState<'text' | 'rich'>('rich');
  const [from, setFrom] = useState(defaultFrom || '');
  const [attachments, setAttachments] = useState<SendAttachmentItem[]>([]);
  const [attachmentBytes, setAttachmentBytes] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  React.useEffect(() => {
    if (defaultFrom) setFrom(defaultFrom);
  }, [defaultFrom]);

  const handleInlineImageTooLarge = useCallback(() => {
    setError(t('send.inlineImageTooLarge'));
  }, [t]);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError('');

    let nextBytes = attachmentBytes;
    const nextAttachments = [...attachments];

    for (const file of Array.from(files)) {
      if (nextBytes + file.size > MAX_ATTACHMENT_BYTES) {
        setError(t('send.attachmentSizeLimit'));
        break;
      }
      const content = await fileToBase64(file);
      nextAttachments.push({ name: file.name, content });
      nextBytes += file.size;
    }

    setAttachments(nextAttachments);
    setAttachmentBytes(nextBytes);
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    const removed = attachments[index];
    const approxBytes = Math.floor((removed.content.length * 3) / 4);
    setAttachments(attachments.filter((_, i) => i !== index));
    setAttachmentBytes(Math.max(0, attachmentBytes - approxBytes));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    let bodyText: string | undefined;
    let bodyHtml: string | undefined;

    if (bodyMode === 'text') {
      if (!text.trim()) {
        setError(t('send.bodyRequired'));
        return;
      }
      bodyText = text;
    } else {
      if (isQuillEmpty(html)) {
        setError(t('send.bodyRequired'));
        return;
      }
      const inlineBytes = getInlineDataUrlBytes(html);
      if (inlineBytes > MAX_INLINE_IMAGES_TOTAL) {
        setError(t('send.inlineImagesTotalLimit'));
        return;
      }
      bodyHtml = html;
      bodyText = stripHtmlToText(html) || undefined;
    }

    setLoading(true);
    const result = await sendUserEmail({
      to,
      subject,
      text: bodyText,
      html: bodyHtml,
      from: from || undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
    setLoading(false);
    if (result.success) {
      setTo('');
      setSubject('');
      setText('');
      setHtml('');
      setAttachments([]);
      setAttachmentBytes(0);
      setSuccess(true);
      onSent?.();
    } else {
      setError(result.error || t('send.failed'));
    }
  };

  const inlineBytes = bodyMode === 'rich' ? getInlineDataUrlBytes(html) : 0;
  const showInlineSizeWarning = inlineBytes > MAX_INLINE_IMAGES_TOTAL * 0.8;

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
          className="w-full px-3 py-2 min-h-10 border rounded-md bg-background text-sm mt-1"
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
          className="w-full px-3 py-2 min-h-10 border rounded-md bg-background text-sm mt-1"
        />
      </div>
      <div>
        <label className="text-sm font-medium">{t('send.subject')}</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full px-3 py-2 min-h-10 border rounded-md bg-background text-sm mt-1"
          required
        />
      </div>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="text-sm font-medium">{t('send.body')}</label>
          <div className="flex rounded-md border overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setBodyMode('text')}
              className={`px-3 py-1 ${bodyMode === 'text' ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
            >
              {t('send.bodyText')}
            </button>
            <button
              type="button"
              onClick={() => setBodyMode('rich')}
              className={`px-3 py-1 ${bodyMode === 'rich' ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
            >
              {t('send.bodyRich')}
            </button>
          </div>
        </div>
        {bodyMode === 'text' ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 min-h-10 border rounded-md bg-background text-sm"
            required
          />
        ) : (
          <>
            <RichTextEditor
              value={html}
              onChange={setHtml}
              onImageTooLarge={handleInlineImageTooLarge}
              placeholder={t('send.bodyRichPlaceholder')}
            />
            <p className="text-xs text-muted-foreground mt-1">{t('send.bodyRichHint')}</p>
            {showInlineSizeWarning && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{t('send.bodySizeWarning')}</p>
            )}
          </>
        )}
      </div>
      <div>
        <label className="text-sm font-medium">{t('send.attachments')}</label>
        <input
          type="file"
          multiple
          onChange={handleFiles}
          className="w-full text-sm mt-1 file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-muted file:text-sm"
        />
        <p className="text-xs text-muted-foreground mt-1">{t('send.attachmentHint')}</p>
        {attachments.length > 0 && (
          <ul className="mt-2 space-y-1">
            {attachments.map((a, i) => (
              <li key={`${a.name}-${i}`} className="flex items-center justify-between text-sm bg-muted/40 px-2 py-1 rounded">
                <span className="truncate">{a.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  className="text-muted-foreground hover:text-destructive ml-2"
                  aria-label={t('send.removeAttachment')}
                >
                  <i className="fas fa-times" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full sm:w-auto px-4 py-2 min-h-10 text-sm bg-primary text-primary-foreground rounded-md disabled:opacity-50 hover:bg-primary/90"
      >
        {loading ? t('common.loading') : t('send.submit')}
      </button>
    </form>
  );
};

export default ComposeForm;
