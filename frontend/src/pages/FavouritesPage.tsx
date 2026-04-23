import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPosts } from '@/lib/api';
import { getFavourites, toggleFavourite } from '@/lib/store';
import PostBox from '@/components/PostBox';
import Pagination from '@/components/Pagination';
import { Star } from 'lucide-react';

const ITEMS_PER_PAGE = 12;

export default function FavouritesPage() {
  const [page, setPage] = useState(1);
  const [favIds, setFavIds] = useState<string[]>(() => getFavourites());

  // Fetch ALL posts, then filter to favourites only
  const { data, isLoading } = useQuery({
    queryKey: ['posts', 1, 'all', 1000],
    queryFn: () => fetchPosts(1, 1000),
    staleTime: 60_000,
  });

  const allPosts = data?.data ?? [];
  const favPosts = allPosts.filter(p => favIds.includes(p.id));
  const totalPages = Math.ceil(favPosts.length / ITEMS_PER_PAGE);
  const paginated = favPosts.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleRemove = (id: string) => {
    toggleFavourite(id);
    setFavIds(getFavourites());
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-foreground mb-6">My Favourites ⭐</h1>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-video rounded-[12px] bg-secondary" />
              <div className="h-4 bg-secondary rounded mt-3 w-3/4" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && favPosts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Star className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg">No favourites yet</p>
          <p className="text-sm mt-1">Tap ⭐ on any video to save it here.</p>
        </div>
      )}

      {paginated.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-8">
          {paginated.map(p => <PostBox key={p.id} post={p} />)}
        </div>
      )}
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
