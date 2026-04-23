import { getSubscriptions, toggleSubscription } from '@/lib/store';
import { useState } from 'react';

interface SubscribeButtonProps {
  channelId: string;
  size?: 'sm' | 'md';
}

export default function SubscribeButton({ channelId, size = 'md' }: SubscribeButtonProps) {
  const [subscribed, setSubscribed] = useState(() => getSubscriptions().includes(channelId));

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const isNowSubscribed = toggleSubscription(channelId);
    setSubscribed(isNowSubscribed);
  };

  const sizeClasses = size === 'sm' ? 'px-4 py-1 text-xs' : 'px-5 py-2 text-sm';

  return (
    <button onClick={handleClick}
      className={`rounded-pill font-medium transition-all duration-200 ${sizeClasses} ${
        subscribed
          ? 'bg-secondary text-secondary-foreground hover:bg-tertiary'
          : 'bg-primary text-primary-foreground hover:opacity-90'
      }`}>
      {subscribed ? 'Subscribed ✓' : 'Subscribe'}
    </button>
  );
}
