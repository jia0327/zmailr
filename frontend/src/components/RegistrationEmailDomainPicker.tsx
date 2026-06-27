import React, { useEffect, useId, useRef, useState } from 'react';
import type { RegistrationDomainGroup } from '../config';

interface RegistrationEmailDomainPickerProps {
  value: string;
  onChange: (domain: string) => void;
  domainGroups: RegistrationDomainGroup[];
  disabled?: boolean;
  className?: string;
}

const RegistrationEmailDomainPicker: React.FC<RegistrationEmailDomainPickerProps> = ({
  value,
  onChange,
  domainGroups,
  disabled = false,
  className = '',
}) => {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const selectDomain = (domain: string) => {
    onChange(domain);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        id={listId}
        disabled={disabled || domainGroups.length === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 pl-1 pr-5 font-mono text-sm text-foreground bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 rounded disabled:opacity-50"
      >
        {value}
        <i
          className={`fas fa-chevron-down absolute right-0 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-labelledby={listId}
          className="absolute right-0 top-full z-50 mt-1 min-w-[12rem] max-h-64 overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-lg py-1"
        >
          {domainGroups.map((group) => (
            <div key={group.label}>
              <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/80 sticky top-0">
                {group.label}
              </div>
              {group.domains.map((domain) => (
                <button
                  key={domain}
                  type="button"
                  role="option"
                  aria-selected={domain === value}
                  onClick={() => selectDomain(domain)}
                  className={`w-full text-left px-3 py-1.5 text-sm font-mono hover:bg-accent hover:text-accent-foreground ${
                    domain === value ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300' : ''
                  }`}
                >
                  {domain}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RegistrationEmailDomainPicker;
