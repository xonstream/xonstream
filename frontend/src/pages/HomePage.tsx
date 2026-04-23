import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import PostBox from '@/components/PostBox';
import CategoryPills from '@/components/CategoryPills';
import Pagination from '@/components/Pagination';
import { fetchPosts, fetchCategories } from '@/lib/api';

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFromUrl = searchParams.get('category') || '';
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState(categoryFromUrl);

  // Sync category from URL when navigating to homepage
  useEffect(() => {
    setCategory(categoryFromUrl);
    setPage(1);
  }, [categoryFromUrl]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['posts', page, category],
    queryFn: () => {
      return fetchPosts(page, 12, category || undefined);
    },
    staleTime: 60_000,
  });

  // Fetch categories from the API (admin-managed, not derived from posts)
  const { data: catsData } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 300_000,
  });

  // Filter out empty/"Uncategorized" entries; use name as ID since posts store category by name
  const catOptions = (catsData?.data ?? [])
    .filter(c => c.id && c.name && c.name.toLowerCase() !== 'uncategorized')
    .map(c => ({ id: c.name, name: c.name }));

  const handleCategoryChange = (id: string) => {
    const newCategory = id === 'all' ? '' : id;
    setCategory(newCategory);
    setPage(1);
    // Update URL with category parameter
    if (newCategory) {
      setSearchParams({ category: newCategory });
    } else {
      setSearchParams({});
    }
  };

  return (
    <div className="p-2 sm:p-4">
      <CategoryPills active={category} onSelect={handleCategoryChange} categories={catOptions} />

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-2 sm:gap-x-4 gap-y-6 sm:gap-y-8 mt-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-video rounded-[12px] bg-secondary" />
              <div className="flex gap-3 mt-3">
                <div className="w-8 h-8 rounded-full bg-secondary flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-secondary rounded w-3/4" />
                  <div className="h-3 bg-secondary rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <p className="text-lg font-semibold">Could not connect to server</p>
          <p className="text-sm mt-1">Make sure the backend is running.</p>
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-2 sm:gap-x-4 gap-y-6 sm:gap-y-8 mt-4">
            {data.data.map(post => <PostBox key={post.id} post={post} />)}
          </div>
          {data.data.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <p className="text-lg">No videos found in this category</p>
            </div>
          )}
          <Pagination
            currentPage={data.pagination.page}
            totalPages={data.pagination.totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
