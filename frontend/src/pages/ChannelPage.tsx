import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchChannelPosts } from '@/lib/api';
import PostBox from '@/components/PostBox';
import SubscribeButton from '@/components/SubscribeButton';
import Pagination from '@/components/Pagination';
import { BadgeCheck } from 'lucide-react';

export default function ChannelPage() {
  const { channelId } = useParams();
  const [page, setPage] = useState(1);

  // Fetch channel data and posts directly from the channel endpoint
  const { data: channelData, isLoading } = useQuery({
    queryKey: ['channel', channelId, page],
    queryFn: () => fetchChannelPosts(channelId!, page),
    enabled: !!channelId,
    staleTime: 60_000,
  });

  const channel = channelData?.data?.channel;
  const posts = channelData?.data?.posts ?? [];
  const totalPages = channelData?.data?.pagination?.totalPages ?? 1;

  // Dynamic SEO metadata
  useState(() => {
    if (channel?.name) {
      document.title = `${channel.name} — Videos and Updates | XON STREAM`;
    }
  });

  if (!channelId) {
    return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">Channel not found</div>;
  }

  if (isLoading && !channel) {
    return (
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="aspect-video rounded-[12px] bg-secondary" />
          </div>
        ))}
      </div>
    );
  }

  // Channel not found after loading
  if (!isLoading && !channel) {
    return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">Channel not found</div>;
  }

  return (
    <div>
      {/* Banner */}
      {channel?.banner && (
        <div className="h-44 lg:h-48 overflow-hidden mx-4 rounded-[12px]">
          <img src={channel.banner} alt={channel.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
        </div>
      )}

      {/* Info */}
      <div className="p-4 flex flex-col sm:flex-row items-start gap-4">
        {channel?.logo ? (
          <img src={channel.logo} alt={channel?.name} className={`w-20 h-20 rounded-full border-4 border-background object-cover ${channel?.banner ? '-mt-10' : ''}`} loading="lazy" decoding="async" />
        ) : (
          <div className={`w-20 h-20 rounded-full border-4 border-background bg-secondary flex items-center justify-center text-2xl font-bold text-muted-foreground ${channel?.banner ? '-mt-10' : ''}`}>
            {channel?.name?.[0] ?? '?'}
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            {channel?.name ?? 'Loading...'} {channel?.verified && <BadgeCheck className="w-5 h-5 text-accent" />}
          </h1>
          {channel?.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{channel.description}</p>
          )}
          {channel?.totalVideos != null && channel.totalVideos > 0 && (
            <p className="text-xs text-muted-foreground mt-1">{channel.totalVideos} videos</p>
          )}
        </div>
        {channel && <SubscribeButton channelId={channel.id} />}
      </div>

      {/* Grid */}
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
        <div className="py-20 text-center text-muted-foreground">No videos found for this channel</div>
      )}
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
