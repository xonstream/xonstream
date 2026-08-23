import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPosts } from '@/lib/api';
import { getLikes, getFavourites, toggleLike } from '@/lib/store';
import PostBox from '@/components/PostBox';
import Pagination from '@/components/Pagination';
import { ThumbsUp, Heart } from 'lucide-react';

const ITEMS_PER_PAGE = 12;

export default function LikedVideosPage() {
  const [page, setPage] = useState(1);
  const [likedIds, setLikedIds] = useState<string[]>(() => {
    const likes = getLikes();
    const favs = getFavourites();
    return Array.from(new Set([...likes, ...favs]));
  });

  useEffect(() => {
    document.title = 'Liked Videos — Your Favorite Adult Videos | XON STREAM';
  }, []);

  // Fetch posts from Supabase and filter to liked only
  const { data, isLoading } = useQuery({
    queryKey: ['posts', 1, 'all', 1000],
    queryFn: () => fetchPosts(1, 1000),
    staleTime: 60_000,
  });

  const allPosts = data?.data ?? [];
  const likedPosts = allPosts.filter(p => likedIds.includes(p.id));
  const totalPages = Math.ceil(likedPosts.length / ITEMS_PER_PAGE);
  const paginated = likedPosts.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="p-2 sm:p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            Liked Videos <ThumbsUp className="w-6 h-6 text-accent fill-accent" />
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Videos you have liked across XON STREAM ({likedPosts.length} saved)</p>
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

      {!isLoading && likedPosts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <ThumbsUp className="w-16 h-16 mb-4 opacity-30 text-accent" />
          <p className="text-lg font-semibold text-foreground">No liked videos yet</p>
          <p className="text-sm mt-1">Tap the 👍 Like button on any video to save it here.</p>
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
