import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPosts } from '@/lib/api';
import { getRecentHistory, clearHistory } from '@/lib/store';
import PostBox from '@/components/PostBox';
import Pagination from '@/components/Pagination';
import { Clock } from 'lucide-react';

const ITEMS_PER_PAGE = 12;

export default function HistoryPage() {
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);

  const recentEntries = getRecentHistory(24);
  const historyIds = recentEntries.map(e => e.videoId);

  const { data } = useQuery({
    queryKey: ['posts', 1, 'all', 1000],
    queryFn: () => fetchPosts(1, 1000),
    staleTime: 60_000,
    enabled: historyIds.length > 0,
  });

  const allPosts = data?.data ?? [];
  // Order by watch time (most recent first), matching history entry order
  const historyPosts = historyIds
    .map(id => allPosts.find(p => p.id === id))
    .filter(Boolean) as typeof allPosts;

  const totalPages = Math.ceil(historyPosts.length / ITEMS_PER_PAGE);
  const paginated = historyPosts.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleClear = () => {
    clearHistory();
    setTick(t => t + 1);
  };

  return (
    <div className="p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Watch History 🕐 24hr</h1>
        {historyPosts.length > 0 && (
          <button onClick={handleClear}
            className="px-4 py-2 rounded-[20px] border border-primary text-primary text-sm font-medium hover:bg-primary/10 transition-colors w-full sm:w-auto">
            Clear History
          </button>
        )}
      </div>

      {historyPosts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-8">
          {paginated.map(p => <PostBox key={p.id} post={p} />)}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Clock className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg">No watch history in the last 24 hours</p>
          <p className="text-sm mt-1">Videos you watch will appear here.</p>
        </div>
      )}
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
