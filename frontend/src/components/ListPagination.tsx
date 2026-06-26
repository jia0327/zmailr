import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const HISTORY_PAGE_SIZE = 3;

export function useClientPagination<T>(items: T[], pageSize = HISTORY_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const pageItems = items.slice((page - 1) * pageSize, page * pageSize);
  const resetPage = () => setPage(1);

  return { page, setPage, totalPages, pageItems, resetPage };
}

interface ListPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

const ListPagination: React.FC<ListPaginationProps> = ({
  page,
  totalPages,
  onPageChange,
  disabled = false,
}) => {
  const { t } = useTranslation();

  if (totalPages <= 1) return null;

  return (
    <div className="px-4 py-3 border-t bg-muted/10 flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={disabled || page <= 1}
        className="px-3 py-2 min-h-10 text-xs rounded-md hover:bg-muted transition-colors text-muted-foreground disabled:opacity-40"
      >
        {t('history.prevPage')}
      </button>
      <span className="text-xs text-muted-foreground tabular-nums">
        {t('history.pageInfo', { current: page, total: totalPages })}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={disabled || page >= totalPages}
        className="px-3 py-2 min-h-10 text-xs rounded-md hover:bg-muted transition-colors text-muted-foreground disabled:opacity-40"
      >
        {t('history.nextPage')}
      </button>
    </div>
  );
};

export default ListPagination;
