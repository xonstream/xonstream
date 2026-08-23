import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchActorById } from '@/lib/api';
import PostBox from '@/components/PostBox';
import Pagination from '@/components/Pagination';

const ITEMS_PER_PAGE = 12;

export default function ActorPage() {
  const { actorId } = useParams();
  const [page, setPage] = useState(1);

  // Fetch actor with their posts using the dedicated endpoint
  const { data: actorData, isLoading } = useQuery({
    queryKey: ['actor', actorId, page],
    queryFn: () => fetchActorById(actorId!, page, ITEMS_PER_PAGE),
    enabled: !!actorId,
    staleTime: 60_000,
  });

  const actor = actorData?.data?.actor;
  const posts = actorData?.data?.posts ?? [];
  const totalPages = actorData?.data?.pagination?.totalPages ?? 1;

  if (actor?.name) {
    document.title = `${actor.name} — Free Adult Videos and Profile | XON STREAM`;
  }

  if (!actor && !isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">Actor not found</div>;
  }

  return (
    <div>
      {/* Actor Profile */}
      <div className="flex flex-col items-center py-8 px-4">
        {actor?.image ? (
          <div className="w-32 h-32 rounded-full border-4 border-accent/40 shadow-xl shadow-accent/20 overflow-hidden bg-secondary">
            <img
              src={actor.image}
              alt={actor?.name || 'Actor'}
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
        ) : (
          <div className="w-32 h-32 rounded-full border-4 border-accent/40 shadow-xl shadow-accent/20 bg-secondary flex items-center justify-center text-4xl font-bold text-muted-foreground">
            {actor?.name?.[0] ?? '?'}
          </div>
        )}
        <h1 className="text-2xl font-bold text-foreground mt-4">{actor?.name ?? 'Loading...'}</h1>
      </div>

      {/* Videos Grid */}
      {isLoading && (
        <div className="p-2 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-3 sm:gap-x-4 gap-y-4 sm:gap-y-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-video rounded-[12px] bg-secondary" />
            </div>
          ))}
        </div>
      )}
      {posts.length > 0 && (
        <div className="p-2 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-3 sm:gap-x-4 gap-y-4 sm:gap-y-6">
          {posts.map(p => <PostBox key={p.id} post={p} />)}
        </div>
      )}
      {!isLoading && posts.length === 0 && (
        <div className="py-20 text-center text-muted-foreground">No videos found for this actor</div>
      )}
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
