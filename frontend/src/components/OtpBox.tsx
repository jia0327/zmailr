import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { extractRuleUrl } from '../utils/emailOtp';

interface OtpBoxProps {
  code: string;
  onCopy?: () => void;
  size?: 'sm' | 'md';
  className?: string;
  matchedRuleId?: number | null;
}

const OtpBox: React.FC<OtpBoxProps> = ({
  code,
  onCopy,
  size = 'sm',
  className,
  matchedRuleId,
}) => {
  const { t } = useTranslation();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCopy) {
      navigator.clipboard.writeText(code);
      onCopy();
    }
  };

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center rounded-lg border border-amber-500/40 bg-amber-50/90 dark:bg-amber-950/30 shadow-sm',
        size === 'sm' ? 'min-w-[7.5rem] px-3 py-2.5' : 'min-w-[11rem] px-5 py-4',
        className
      )}
    >
      <span className="absolute top-1 right-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t('email.otpLabel')}
      </span>
      {onCopy ? (
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            'cursor-pointer transition-colors hover:text-amber-700 dark:hover:text-amber-400',
            'font-mono font-bold tracking-[0.2em] text-amber-600',
            size === 'sm' ? 'text-xl' : 'text-3xl'
          )}
          title={t('email.clickToCopy')}
        >
          {code}
        </button>
      ) : (
        <span
          className={cn(
            'font-mono font-bold tracking-[0.2em] text-amber-600',
            size === 'sm' ? 'text-xl' : 'text-3xl'
          )}
        >
          {code}
        </span>
      )}
      {matchedRuleId != null && (
        <Link
          to={extractRuleUrl(matchedRuleId)}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 text-[10px] leading-tight text-muted-foreground hover:text-primary hover:underline"
        >
          {t('email.matchedRule', { id: matchedRuleId })}
        </Link>
      )}
    </div>
  );
};

export default OtpBox;
