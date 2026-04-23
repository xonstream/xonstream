import { useState } from 'react';
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

  const { data } = useQuery({
    queryKey: ['posts', 1, 'all', 1000],
    queryFn: () => fetchPosts(1, 1000),
    staleTime: 60_000,
  });

  // Filter posts whose channelName matches a subscribed channel
  const allPosts = data?.data ?? [];
  const subPosts = subIds.length > 0
    ? allPosts.filter(p => subIds.some(id => p.channelName?.toLowerCase().includes(id.toLowerCase())))
    : [];
  const totalPages = Math.ceil(subPosts.length / ITEMS_PER_PAGE);
  const paginated = subPosts.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-foreground mb-6">Subscriptions</h1>
      {paginated.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-8">
          {paginated.map(p => <PostBox key={p.id} post={p} />)}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Bell className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg">No subscriptions yet</p>
          <p className="text-sm mt-1">Subscribe to channels to see their videos here.</p>
        </div>
      )}
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
