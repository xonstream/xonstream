import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchPosts } from '@/lib/api';
import PostBox from '@/components/PostBox';
import Pagination from '@/components/Pagination';
import { Search } from 'lucide-react';

export default function SearchPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const query = params.get('q') || '';
  const category = params.get('category') || '';
  const actor = params.get('actor') || '';
  const channel = params.get('channel') || '';
  const [page, setPage] = useState(1);

  // Redirect to homepage only if no search criteria are provided
  useEffect(() => {
    if (!query && !category && !actor && !channel) {
      navigate('/', { replace: true });
    }
  }, [query, category, actor, channel, navigate]);

  // Reset page when search criteria change & update SEO title
  useEffect(() => {
    setPage(1);
    if (query) {
      document.title = `Search results for "${query}" | XON STREAM`;
    } else if (actor) {
      document.title = `${actor} — Videos and Scenes | XON STREAM`;
    } else if (category) {
      document.title = `${category} — Search Videos | XON STREAM`;
    } else if (channel) {
      document.title = `${channel} — Channel Videos | XON STREAM`;
    }
  }, [query, category, actor, channel]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['search', query, category, actor, channel, page],
    queryFn: () => {
      return searchPosts({ 
        q: query || undefined, 
        category: category || undefined, 
        actor: actor || undefined,
        channel: channel || undefined,
        page 
      });
    },
    enabled: !!(query || category || actor || channel),
    staleTime: 60_000,
  });

  const totalResults = data?.pagination?.total ?? 0;
  const pageTitle = actor 
    ? `Videos featuring "${actor}"` 
    : channel 
      ? `Videos from "${channel}"` 
      : category 
        ? `Category: ${category}` 
        : `Results for "${query}"`;

  return (
    <div className="p-2 sm:p-4">
      <h1 className="text-base sm:text-lg font-semibold text-foreground mb-0.5">{pageTitle}</h1>
      <p className="text-xs text-muted-foreground mb-4">
        {isLoading ? 'Searching…' : data ? `${totalResults} video(s) found` : ''}
      </p>

      {/* Grid container with tight modern spacing */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-3 sm:gap-x-4 gap-y-4 sm:gap-y-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-video rounded-[12px] bg-secondary" />
              <div className="flex gap-3 mt-3">
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-secondary rounded w-3/4" />
                  <div className="h-3 bg-secondary rounded w-1/2" />
                </div>
              </div>
            </div>
          ))
        ) : isError ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Search className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg">Could not reach the server</p>
          </div>
        ) : data && data.data.length > 0 ? (
          data.data.map(post => <PostBox key={post.id} post={post} />)
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Search className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg">No results found for {actor || channel || category || query}</p>
            <p className="text-sm mt-1">Try different keywords or explore categories</p>
          </div>
        )}
      </div>
      
      {data && data.data.length > 0 && (
        <Pagination currentPage={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}
