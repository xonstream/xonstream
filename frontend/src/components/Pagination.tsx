import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const handlePageClick = (page: number) => {
    onPageChange(page);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  };

  const getPages = () => {
    const pages: (number | '...')[] = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    if (start > 1) { pages.push(1); if (start > 2) pages.push('...'); }
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages) { if (end < totalPages - 1) pages.push('...'); pages.push(totalPages); }
    return pages;
  };

  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      <button onClick={() => handlePageClick(currentPage - 1)} disabled={currentPage === 1}
        className="p-2 rounded-pill bg-secondary text-secondary-foreground disabled:opacity-30 hover:bg-tertiary transition-colors">
        <ChevronLeft className="w-4 h-4" />
      </button>
      {getPages().map((page, i) => (
        page === '...' ? (
          <span key={`dots-${i}`} className="px-2 text-muted-foreground">...</span>
        ) : (
          <button key={page} onClick={() => handlePageClick(page)}
            className={`w-9 h-9 rounded-pill text-sm font-medium transition-colors ${
              page === currentPage ? 'bg-foreground text-background' : 'bg-secondary text-secondary-foreground hover:bg-tertiary'
            }`}>
            {page}
          </button>
        )
      ))}
      <button onClick={() => handlePageClick(currentPage + 1)} disabled={currentPage === totalPages}
        className="p-2 rounded-pill bg-secondary text-secondary-foreground disabled:opacity-30 hover:bg-tertiary transition-colors">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
