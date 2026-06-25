import React from 'react';

interface DashboardPageHeaderProps {
  breadcrumb: string;
  title: string;
  subtitle?: string;
}

const DashboardPageHeader: React.FC<DashboardPageHeaderProps> = ({ breadcrumb, title, subtitle }) => {
  return (
    <div className="mb-6">
      <p className="text-sm text-muted-foreground mb-1">{breadcrumb}</p>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
};

export default DashboardPageHeader;
