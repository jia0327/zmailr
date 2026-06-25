import React from 'react';

interface DashboardPageHeaderProps {
  breadcrumb: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

const DashboardPageHeader: React.FC<DashboardPageHeaderProps> = ({ breadcrumb, title, subtitle, action }) => {
  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div>
        <p className="text-sm text-muted-foreground mb-1">{breadcrumb}</p>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};

export default DashboardPageHeader;
