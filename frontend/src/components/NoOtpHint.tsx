import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { extractRulesUrl, extractSenderDomain, isVerificationLikeSubject } from '../utils/emailOtp';

interface NoOtpHintProps {
  fromAddress: string;
  subject?: string | null;
  variant?: 'inline' | 'detail';
  className?: string;
}

const NoOtpHint: React.FC<NoOtpHintProps> = ({
  fromAddress,
  subject,
  variant = 'inline',
  className,
}) => {
  const { t } = useTranslation();
  const senderDomain = extractSenderDomain(fromAddress);
  const verificationLike = isVerificationLikeSubject(subject);
  const rulesUrl = extractRulesUrl(senderDomain);

  if (variant === 'inline') {
    return (
      <Link
        to={rulesUrl}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'shrink-0 text-xs rounded px-1.5 py-0.5 border transition-colors hover:bg-muted/50',
          verificationLike
            ? 'border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-50/80 dark:bg-amber-950/30 font-medium'
            : 'border-muted text-muted-foreground',
          className
        )}
        title={verificationLike ? t('email.noExtractedCodeStrong') : t('email.noExtractedCodeBody')}
      >
        {t('email.noExtractedCode')}
      </Link>
    );
  }

  return (
    <div
      className={cn(
        'rounded-md border p-4 text-sm',
        verificationLike
          ? 'border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/25'
          : 'border-muted bg-muted/20',
        className
      )}
    >
      <p className={cn('font-medium', verificationLike ? 'text-amber-800 dark:text-amber-300' : 'text-foreground')}>
        {t('email.noExtractedCode')}
      </p>
      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
        {verificationLike ? t('email.noExtractedCodeStrong') : t('email.noExtractedCodeBody')}
      </p>
      <Link
        to={rulesUrl}
        className={cn(
          'inline-flex items-center gap-1 mt-3 text-xs font-medium hover:underline',
          verificationLike ? 'text-amber-700 dark:text-amber-400' : 'text-primary'
        )}
      >
        {t('email.addExtractRule')}
        {senderDomain && (
          <span className="text-muted-foreground font-normal">({senderDomain})</span>
        )}
        <i className="fas fa-arrow-right text-[10px]" aria-hidden />
      </Link>
    </div>
  );
};

export default NoOtpHint;
