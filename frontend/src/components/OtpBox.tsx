import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';

interface OtpBoxProps {
  code: string;
  onCopy?: () => void;
  size?: 'sm' | 'md';
  className?: string;
}

const OtpBox: React.FC<OtpBoxProps> = ({ code, onCopy, size = 'sm', className }) => {
  const { t } = useTranslation();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCopy) {
      navigator.clipboard.writeText(code);
      onCopy();
    }
  };

  const Wrapper = onCopy ? 'button' : 'div';

  return (
    <Wrapper
      type={onCopy ? 'button' : undefined}
      onClick={onCopy ? handleClick : undefined}
      className={cn(
        'relative flex flex-col items-center justify-center rounded-lg border border-amber-500/40 bg-amber-50/90 shadow-sm',
        size === 'sm' ? 'min-w-[7.5rem] px-3 py-2.5' : 'min-w-[11rem] px-5 py-4',
        onCopy && 'cursor-pointer transition-colors hover:border-amber-500/60 hover:bg-amber-50',
        className
      )}
      title={onCopy ? t('email.clickToCopy') : undefined}
    >
      <span className="absolute top-1 right-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t('email.otpLabel')}
      </span>
      <span
        className={cn(
          'font-mono font-bold tracking-[0.2em] text-amber-600',
          size === 'sm' ? 'text-xl' : 'text-3xl'
        )}
      >
        {code}
      </span>
    </Wrapper>
  );
};

export default OtpBox;
