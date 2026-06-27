import React from 'react';

interface DashboardPageHeaderProps {
  breadcrumb: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

const DashboardPageHeader: React.FC<DashboardPageHeaderProps> = ({ breadcrumb, title, subtitle, action }) => {
  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 min-w-0">
      <div className="min-w-0">
        <p className="text-sm text-sky-700/80 dark:text-muted-foreground mb-1 break-words">{breadcrumb}</p>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight break-words text-slate-900 dark:text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1 break-words">{subtitle}</p>}
      </div>
      {action && (
        <div className="shrink-0 w-full sm:w-auto [&_button]:min-h-10 [&_a]:min-h-10 [&_button]:w-full [&_button]:sm:w-auto [&_a]:w-full [&_a]:sm:w-auto">
          {action}
        </div>
      )}
    </div>
  );
};

export default DashboardPageHeader;
