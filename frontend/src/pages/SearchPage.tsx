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
  const [page, setPage] = useState(1);

  // Redirect to homepage if no search query or category
  useEffect(() => {
    if (!query && !category) {
      navigate('/', { replace: true });
    }
  }, [query, category, navigate]);

  // Reset page when query changes
  useEffect(() => {
    setPage(1);
  }, [query, category]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['search', query, category, page],
    queryFn: () => {
      return searchPosts({ q: query || undefined, category: category || undefined, page });
    },
    enabled: !!(query || category),
    staleTime: 60_000,
  });

  const totalResults = data?.pagination?.total ?? 0;

  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold text-foreground mb-1">Results for "{query}"</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {isLoading ? 'Searching…' : data ? `${totalResults} results found` : ''}
      </p>

      {/* Always render the grid container to prevent layout shift */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-8">
        {isLoading ? (
          // Show skeleton loader
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
          // Show error
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Search className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg">Could not reach the server</p>
          </div>
        ) : data && data.data.length > 0 ? (
          // Show results
          data.data.map(post => <PostBox key={post.id} post={post} />)
        ) : (
          // Show no results
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Search className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg">No results found for "{query}"</p>
            <p className="text-sm mt-1">Try different keywords</p>
          </div>
        )}
      </div>
      
      {/* Pagination only when we have data */}
      {data && data.data.length > 0 && (
        <Pagination currentPage={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}
