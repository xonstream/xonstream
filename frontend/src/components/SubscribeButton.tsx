import { getSubscriptions, toggleSubscription } from '@/lib/store';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface SubscribeButtonProps {
  channelId: string;
  channelName?: string;
  size?: 'sm' | 'md' | 'lg';
  navigateOnSubscribe?: boolean;
}

export default function SubscribeButton({ 
  channelId, 
  channelName,
  size = 'md',
  navigateOnSubscribe = true
}: SubscribeButtonProps) {
  const navigate = useNavigate();
  const [subscribed, setSubscribed] = useState(() => getSubscriptions().includes(channelId));
  const [isRinging, setIsRinging] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const isNowSubscribed = toggleSubscription(channelId);
    setSubscribed(isNowSubscribed);

    if (isNowSubscribed) {
      // Trigger YouTube-style bell ring animation
      setIsRinging(true);
      toast.success(
        channelName ? `Subscribed to ${channelName}! 🔔` : 'Subscribed to channel! 🔔',
        { description: 'Viewing latest to oldest uploads...' }
      );

      // Slide open ring animation and smoothly navigate to channel uploads
      if (navigateOnSubscribe) {
        setTimeout(() => {
          navigate(`/channel/${channelId}`);
        }, 500);
      }

      setTimeout(() => {
        setIsRinging(false);
      }, 1200);
    } else {
      toast.info('Unsubscribed from channel');
    }
  };

  const sizeClasses = size === 'sm' 
    ? 'px-3.5 py-1.5 text-xs' 
    : size === 'lg' 
      ? 'px-6 py-3 text-sm' 
      : 'px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm';

  return (
    <div className="relative inline-flex items-center">
      {/* YouTube-style Expanding Ring Ripple Wave */}
      {isRinging && (
        <>
          <span className="absolute inset-0 rounded-full bg-red-500/40 animate-ping pointer-events-none" />
          <span className="absolute -inset-1 rounded-full border-2 border-red-400 animate-pulse pointer-events-none" />
        </>
      )}

      <button
        onClick={handleClick}
        className={`relative rounded-full font-bold transition-all duration-300 flex items-center gap-1.5 shadow-md active:scale-95 overflow-hidden ${sizeClasses} ${
          subscribed
            ? 'bg-secondary/80 hover:bg-secondary text-secondary-foreground border border-white/10'
            : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30 hover:shadow-lg hover:shadow-red-600/40'
        }`}
      >
        {subscribed ? (
          <>
            <Bell className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent ${isRinging ? 'animate-bounce' : ''}`} />
            <span className="tracking-wide">Subscribed</span>
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          </>
        ) : (
          <>
            <Bell className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isRinging ? 'animate-spin' : ''}`} />
            <span className="tracking-wide">Subscribe</span>
          </>
        )}
      </button>
    </div>
  );
}
