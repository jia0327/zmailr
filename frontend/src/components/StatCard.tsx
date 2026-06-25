import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  hint?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, hint }) => {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold mt-1 truncate">{value}</p>
          {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
        </div>
        <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          <i className={`${icon} text-sm text-primary`} />
        </div>
      </div>
    </div>
  );
};

export default StatCard;
