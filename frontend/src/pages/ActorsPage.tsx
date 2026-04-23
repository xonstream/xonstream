import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchActors } from '@/lib/api';
import Pagination from '@/components/Pagination';
import { useState } from 'react';
import type { Actor } from '@/lib/types';
import { Users } from 'lucide-react';

const ITEMS_PER_PAGE = 18;

export default function ActorsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['actors'],
    queryFn: fetchActors,
    staleTime: 300_000,
  });

  const actors: Actor[] = data?.data ?? [];
  const totalPages = Math.ceil(actors.length / ITEMS_PER_PAGE);
  const paginated = actors.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-foreground mb-6">Actors</h1>

      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-card rounded-[12px] h-40 border border-border" />
          ))}
        </div>
      )}

      {!isLoading && actors.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Users className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg">No actors yet</p>
          <p className="text-sm mt-1">Add actors from the Admin Dashboard.</p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {paginated.map(actor => (
          <Link key={actor.id} to={`/actor/${actor.id}`}
            className="bg-card rounded-[12px] overflow-hidden card-hover block border border-border hover:border-accent/30 transition-all">
            <div className="flex flex-col items-center py-6 px-3">
              {actor.image ? (
                <div className="w-24 h-24 rounded-full overflow-hidden" style={{ background: 'var(--secondary)' }}>
                  <div style={{
                    width: '100%', height: '100%',
                    backgroundImage: `url(${actor.image})`,
                    backgroundSize: `${Math.round((actor.cropZoom ?? 1) * 100)}%`,
                    backgroundPosition: `${actor.cropX ?? 50}% ${actor.cropY ?? 50}%`,
                    backgroundRepeat: 'no-repeat',
                  }} />
                </div>
              ) : (
                <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center text-2xl font-bold text-muted-foreground uppercase">
                  {actor.name?.[0] ?? '?'}
                </div>
              )}
              <p className="text-sm font-semibold text-card-foreground truncate mt-3 text-center">{actor.name}</p>
              {actor.totalVideos != null && actor.totalVideos > 0 && (
                <p className="text-xs text-muted-foreground mt-1">{actor.totalVideos} videos</p>
              )}
            </div>
          </Link>
        ))}
      </div>

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
