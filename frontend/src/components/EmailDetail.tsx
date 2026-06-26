import React, { useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { MailboxContext } from '../contexts/MailboxContext';
import { stripHtmlToText } from '../utils/htmlBody';
import OtpBox from './OtpBox';
import NoOtpHint from './NoOtpHint';

interface EmailDetailProps {
  emailId: string;
  onClose: () => void;
}

interface Attachment {
  id: string;
  emailId: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: number;
  isLarge: boolean;
  chunksCount: number;
}

const EmailDetail: React.FC<EmailDetailProps> = ({ emailId, onClose }) => {
  const { t } = useTranslation();
  const {
    emailCache,
    addToEmailCache,
    handleMailboxNotFound,
    showErrorMessage,
    showSuccessMessage,
    emails,
    setEmails,
  } = useContext(MailboxContext);
  const [email, setEmail] = useState<Email | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);
  const [isReExtracting, setIsReExtracting] = useState(false);
  const [isDownloadingRaw, setIsDownloadingRaw] = useState(false);

  useEffect(() => {
    const fetchEmail = async () => {
      try {
        if (emailCache[emailId]) {
          setEmail(emailCache[emailId].email);
          setAttachments(emailCache[emailId].attachments);
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/emails/${emailId}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          if (response.status === 404) {
            await handleMailboxNotFound();
            onClose();
            return;
          }
          throw new Error('Failed to fetch email');
        }

        const data = await response.json();
        if (data.success) {
          setEmail(data.email);
          if (data.email.hasAttachments) {
            await fetchAttachments(emailId, data.email);
          } else {
            addToEmailCache(emailId, data.email, []);
          }
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } catch (error) {
        showErrorMessage(t('email.fetchFailed'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmail();
  }, [emailId, t, emailCache, addToEmailCache, handleMailboxNotFound, onClose, showErrorMessage]);

  const fetchAttachments = async (emailId: string, emailData?: Email) => {
    try {
      setIsLoadingAttachments(true);
      const response = await fetch(`${API_BASE_URL}/api/emails/${emailId}/attachments`, {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 404) {
          await handleMailboxNotFound();
          onClose();
          return;
        }
        throw new Error('Failed to fetch attachments');
      }

      const data = await response.json();
      if (data.success) {
        setAttachments(data.attachments);
        if (emailData) {
          addToEmailCache(emailId, emailData, data.attachments);
        }
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error fetching attachments:', error);
    } finally {
      setIsLoadingAttachments(false);
    }
  };

  const handleDelete = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/emails/${emailId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to delete email');

      const data = await response.json();
      if (data.success) {
        showSuccessMessage(t('email.deleteSuccess'));
        setTimeout(() => onClose(), 2000);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      showErrorMessage(t('email.deleteFailed'));
    }
  };

  const applyEmailUpdate = (updated: Email) => {
    setEmail(updated);
    addToEmailCache(emailId, updated, attachments);
    setEmails(emails.map((item: Email) => (item.id === emailId ? { ...item, ...updated } : item)));
  };

  const handleReExtract = async () => {
    try {
      setIsReExtracting(true);
      const response = await fetch(`${API_BASE_URL}/api/user/emails/${emailId}/re-extract`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 404) {
          await handleMailboxNotFound();
          onClose();
          return;
        }
        throw new Error('Failed to re-extract');
      }

      const data = await response.json();
      if (!data.success) throw new Error(data.error || 'Unknown error');

      applyEmailUpdate(data.email);
      if (data.email.extractedCode) {
        showSuccessMessage(t('email.reExtractSuccess'));
      } else {
        showErrorMessage(t('email.reExtractNoCode'));
      }
    } catch {
      showErrorMessage(t('email.reExtractFailed'));
    } finally {
      setIsReExtracting(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileType = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.includes('text/')) return 'text';
    return 'file';
  };

  const getFileIcon = (mimeType: string): string => {
    const fileType = getFileType(mimeType);
    switch (fileType) {
      case 'image': return 'fa-file-image';
      case 'video': return 'fa-file-video';
      case 'audio': return 'fa-file-audio';
      case 'pdf': return 'fa-file-pdf';
      case 'text': return 'fa-file-alt';
      default: return 'fa-file';
    }
  };

  const getAttachmentUrl = (attachmentId: string, download: boolean = false): string => {
    return `${API_BASE_URL}/api/attachments/${attachmentId}${download ? '?download=true' : ''}`;
  };

  const getPlainText = (emailData: Email): string => {
    if (emailData.textContent?.trim()) return emailData.textContent.trim();
    if (emailData.htmlContent) return stripHtmlToText(emailData.htmlContent);
    return '';
  };

  const handleDownloadRaw = async () => {
    try {
      setIsDownloadingRaw(true);
      const response = await fetch(`${API_BASE_URL}/api/emails/${emailId}/raw`, {
        credentials: 'include',
      });
      if (!response.ok) {
        if (response.status === 404) {
          await handleMailboxNotFound();
          onClose();
          return;
        }
        throw new Error('Failed to download raw email');
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition');
      let filename = `${emailId}.eml`;
      const match = disposition?.match(/filename="?([^";\n]+)"?/);
      if (match?.[1]) filename = match[1];
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      showErrorMessage(t('email.downloadRawFailed'));
    } finally {
      setIsDownloadingRaw(false);
    }
  };

  const handleCopyPlainText = async () => {
    if (!email) return;
    const text = getPlainText(email);
    if (!text) {
      showErrorMessage(t('email.copyPlainTextEmpty'));
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showSuccessMessage(t('email.copyPlainTextSuccess'));
    } catch {
      showErrorMessage(t('email.copyPlainTextFailed'));
    }
  };

  const handleDownloadAttachment = async (attachment: Attachment) => {
    try {
      const response = await fetch(getAttachmentUrl(attachment.id, true), {
        credentials: 'include',
      });
      if (!response.ok) {
        if (response.status === 404) {
          await handleMailboxNotFound();
          onClose();
          return;
        }
        throw new Error('Failed to download attachment');
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = attachment.filename;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      showErrorMessage(t('email.downloadFailed'));
    }
  };

  const renderAttachmentPreview = (attachment: Attachment) => {
    const fileType = getFileType(attachment.mimeType);
    const attachmentUrl = getAttachmentUrl(attachment.id, true);

    switch (fileType) {
      case 'image':
        return (
          <div className="mt-2 max-w-full overflow-hidden">
            <img src={attachmentUrl} alt={attachment.filename} className="max-w-full max-h-[300px] object-contain rounded border" />
          </div>
        );
      case 'video':
        return (
          <div className="mt-2">
            <video src={attachmentUrl} controls className="max-w-full max-h-[300px] rounded border">
              {t('email.videoNotSupported')}
            </video>
          </div>
        );
      case 'audio':
        return (
          <div className="mt-2">
            <audio src={attachmentUrl} controls className="w-full">
              {t('email.audioNotSupported')}
            </audio>
          </div>
        );
      case 'pdf':
        return (
          <div className="mt-2">
            <iframe src={attachmentUrl} className="w-full h-[400px] border rounded" title={attachment.filename} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-4 sm:p-6">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-muted-foreground/20 border-t-foreground"></div>
        </div>
      ) : email ? (
        <div className="space-y-5">
          <div className="flex justify-between items-start gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold mb-2 break-words">
                {email.subject || t('email.noSubject')}
              </h2>
              <div className="text-sm text-muted-foreground space-y-0.5">
                <p><span className="text-foreground/70">{t('email.from')}:</span> {email.fromAddress}</p>
                <p><span className="text-foreground/70">{t('email.to')}:</span> {email.toAddress}</p>
                <p><span className="text-foreground/70">{t('email.date')}:</span> {formatDate(email.receivedAt)}</p>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                onClick={handleReExtract}
                disabled={isReExtracting}
                className="p-2 rounded-md hover:bg-muted transition-colors disabled:opacity-50"
                title={t('email.reExtract')}
              >
                <i className={`fas fa-sync-alt text-sm ${isReExtracting ? 'animate-spin' : ''}`}></i>
              </button>
              <button onClick={onClose} className="p-2 rounded-md hover:bg-muted transition-colors" title={t('common.close')}>
                <i className="fas fa-times"></i>
              </button>
              <button onClick={handleDelete} className="p-2 rounded-md hover:bg-destructive/10 text-destructive transition-colors" title={t('common.delete')}>
                <i className="fas fa-trash-alt"></i>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDownloadRaw}
              disabled={isDownloadingRaw}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border hover:bg-muted transition-colors disabled:opacity-50"
            >
              <i className={`fas fa-download ${isDownloadingRaw ? 'animate-pulse' : ''}`}></i>
              {t('email.downloadRaw')}
            </button>
            <button
              type="button"
              onClick={handleCopyPlainText}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border hover:bg-muted transition-colors"
            >
              <i className="fas fa-copy"></i>
              {t('email.copyPlainText')}
            </button>
          </div>

          {email.extractedCode ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-md border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{t('email.verificationCode')}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t('email.clickToCopy')}</p>
              </div>
              <OtpBox
                code={email.extractedCode}
                size="md"
                className="self-start sm:self-auto"
                matchedRuleId={email.matchedRuleId}
                onCopy={() => showSuccessMessage(t('common.copied'))}
              />
            </div>
          ) : (
            <NoOtpHint
              fromAddress={email.fromAddress}
              subject={email.subject}
              variant="detail"
            />
          )}

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">{t('email.content')}</h3>
            {email.htmlContent ? (
              <div
                className="prose prose-sm max-w-none dark:prose-invert border rounded-md p-4 bg-background"
                dangerouslySetInnerHTML={{ __html: email.htmlContent }}
              />
            ) : email.textContent ? (
              <pre className="whitespace-pre-wrap border rounded-md p-4 bg-background font-sans text-sm">
                {email.textContent}
              </pre>
            ) : (
              <p className="text-muted-foreground italic text-sm">{t('email.noContent')}</p>
            )}
          </div>

          {email.hasAttachments && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                {t('email.attachments')}
                {isLoadingAttachments && (
                  <span className="ml-2 inline-block animate-spin h-4 w-4 border-2 border-muted-foreground/20 border-t-foreground rounded-full"></span>
                )}
              </h3>

              {attachments.length > 0 ? (
                <div className="space-y-2">
                  {attachments.map(attachment => (
                    <div key={attachment.id} className="border rounded-md p-3">
                      <div className="flex justify-between items-center gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <i className={`fas ${getFileIcon(attachment.mimeType)} text-muted-foreground`}></i>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{attachment.filename}</p>
                            <p className="text-xs text-muted-foreground">{formatFileSize(attachment.size)}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDownloadAttachment(attachment)}
                          className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 shrink-0"
                        >
                          {t('email.download')}
                        </button>
                      </div>
                      {renderAttachmentPreview(attachment)}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground italic text-sm">{t('email.noAttachments')}</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground text-sm">{t('email.notFound')}</p>
        </div>
      )}
    </div>
  );
};

export default EmailDetail;
