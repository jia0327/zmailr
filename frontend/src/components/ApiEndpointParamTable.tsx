import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ParamDocRow } from '../utils/apiEndpointMeta';

interface ApiEndpointParamTableProps {
  rows: ParamDocRow[];
  className?: string;
}

const ApiEndpointParamTable: React.FC<ApiEndpointParamTableProps> = ({ rows, className = '' }) => {
  const { t } = useTranslation();

  if (rows.length === 0) return null;

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 pr-3 font-medium">{t('apiDebug.colName')}</th>
            <th className="text-left py-2 pr-3 font-medium">{t('apiDebug.colType')}</th>
            <th className="text-left py-2 pr-3 font-medium">{t('apiDebug.colRequired')}</th>
            <th className="text-left py-2 font-medium">{t('apiDebug.colDescription')}</th>
          </tr>
        </thead>
        <tbody className="text-muted-foreground">
          {rows.map((row) => (
            <tr key={row.name} className="border-b border-border/50">
              <td className="py-2 pr-3 font-mono text-foreground">{row.name}</td>
              <td className="py-2 pr-3 font-mono text-xs">{row.type}</td>
              <td className="py-2 pr-3">{row.required ? t('apiDebug.requiredYes') : t('apiDebug.requiredNo')}</td>
              <td className="py-2">{t(row.descriptionKey)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ApiEndpointParamTable;
