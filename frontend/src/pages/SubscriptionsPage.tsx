import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPosts } from '@/lib/api';
import { getSubscriptions } from '@/lib/store';
import PostBox from '@/components/PostBox';
import Pagination from '@/components/Pagination';
import { Bell } from 'lucide-react';

const ITEMS_PER_PAGE = 12;

export default function SubscriptionsPage() {
  const [page, setPage] = useState(1);
  const subIds = getSubscriptions();

  useEffect(() => {
    document.title = 'Subscriptions — Uploads from Your Subscribed Channels | XON STREAM';
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['posts', 1, 'all', 1000],
    queryFn: () => fetchPosts(1, 1000),
    staleTime: 60_000,
  });

  // Filter posts whose channelId or channelName matches a subscribed channel
  const allPosts = data?.data ?? [];
  const subPosts = subIds.length > 0
    ? allPosts.filter(p => subIds.some(id => 
        (p.channelId && p.channelId.toLowerCase() === id.toLowerCase()) || 
        (p.channelName && p.channelName.toLowerCase().includes(id.toLowerCase()))
      ))
    : [];

  // Sort from latest to oldest
  subPosts.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  const totalPages = Math.ceil(subPosts.length / ITEMS_PER_PAGE);
  const paginated = subPosts.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="p-2 sm:p-4 space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
          Subscriptions <Bell className="w-6 h-6 text-accent fill-accent animate-pulse" />
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Latest to oldest uploads from your {subIds.length} subscribed channels
        </p>
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

      {!isLoading && paginated.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Bell className="w-16 h-16 mb-4 opacity-30 text-accent" />
          <p className="text-lg font-semibold text-foreground">No subscriptions yet</p>
          <p className="text-sm mt-1">Subscribe to channels on video pages to see their latest videos here.</p>
        </div>
      )}

      {paginated.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-3 sm:gap-x-4 gap-y-4 sm:gap-y-6">
          {paginated.map(p => <PostBox key={p.id} post={p} />)}
        </div>
      )}
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
