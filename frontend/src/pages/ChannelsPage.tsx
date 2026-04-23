import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchChannels, searchPosts } from '@/lib/api';
import Pagination from '@/components/Pagination';
import { useState } from 'react';
import type { Channel } from '@/lib/types';
import { Tv } from 'lucide-react';

const ITEMS_PER_PAGE = 18;

export default function ChannelsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['channels'],
    queryFn: fetchChannels,
    staleTime: 300_000,
  });

  const channels: Channel[] = data?.data ?? [];
  const totalPages = Math.ceil(channels.length / ITEMS_PER_PAGE);
  const paginated = channels.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-foreground mb-6">Channels</h1>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-card rounded-[12px] h-24 border border-border" />
          ))}
        </div>
      )}

      {!isLoading && channels.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Tv className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg">No channels yet</p>
          <p className="text-sm mt-1">Add channels from the Admin Dashboard.</p>
        </div>
      )}

      {/* Landscape cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {paginated.map(ch => (
          <Link
            key={ch.id}
            to={`/channel/${ch.id}`}
            className="bg-card border border-border rounded-[12px] overflow-hidden flex items-center gap-4 px-4 py-3 hover:border-accent/40 hover:bg-card/80 transition-all duration-200 group"
          >
            {ch.logo ? (
              <img src={ch.logo} alt={ch.name} className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center text-xl font-bold text-muted-foreground uppercase flex-shrink-0">
                {ch.name?.[0] ?? '?'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate group-hover:text-accent transition-colors">{ch.name}</p>
              {ch.handle && <p className="text-xs text-muted-foreground truncate">{ch.handle}</p>}
              {ch.totalVideos != null && ch.totalVideos > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">{ch.totalVideos} videos</p>
              )}
            </div>
          </Link>
        ))}
      </div>

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
