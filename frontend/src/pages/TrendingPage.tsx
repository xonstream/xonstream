import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTrendingPosts } from '@/lib/api';
import PostBox from '@/components/PostBox';
import Pagination from '@/components/Pagination';
import { TrendingUp, Zap } from 'lucide-react';

const ITEMS_PER_PAGE = 12;

export default function TrendingPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['trending-posts', page],
    queryFn: () => fetchTrendingPosts(page, ITEMS_PER_PAGE),
    staleTime: 30_000,
  });

  const posts = data?.data ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;

  return (
    <div className="p-2 sm:p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            Trending Videos <TrendingUp className="w-6 h-6 text-accent animate-bounce" />
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">High velocity & recent momentum trending algorithm</p>
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-3 sm:gap-x-4 gap-y-4 sm:gap-y-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-video rounded-[12px] bg-secondary" />
              <div className="h-4 bg-secondary rounded mt-3 w-3/4" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && posts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <TrendingUp className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg">No trending videos yet</p>
        </div>
      )}

      {posts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-3 sm:gap-x-4 gap-y-4 sm:gap-y-6">
          {posts.map(p => <PostBox key={p.id} post={p} />)}
        </div>
      )}

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
