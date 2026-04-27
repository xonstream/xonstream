import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CategoryPillsProps {
  active: string;
  onSelect: (id: string) => void;
  categories?: { id: string; name: string }[];
}

export default function CategoryPills({ active, onSelect, categories = [] }: CategoryPillsProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);

  // Filter out unwanted labels/categories
  const blockedPatterns = [
    'example', 'yeh', 'mp4', 'free full video', 'full video', 'free video',
    '⭐️', '⭐', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v', '3gp'
  ];
  
  const isBlocked = (name: string) => {
    const lower = name.toLowerCase();
    return blockedPatterns.some(pattern => lower.includes(pattern));
  };

  // Always include "All" as first option; filter out uncategorized/empty/blocked entries
  const allCats = [
    { id: 'all', name: 'All' },
    ...categories.filter(c => 
      c.id !== 'all' && 
      c.name && 
      c.name.toLowerCase() !== 'uncategorized' &&
      !isBlocked(c.name)
    ),
  ];

  // Don't render if no real categories added (only "All")
  if (allCats.length <= 1) return null;

  // Treat empty string as 'all' for highlighting
  const activeId = !active || active === 'all' ? 'all' : active;

  const scroll = (dir: 'left' | 'right') => {
    if (!ref.current) return;
    const amount = dir === 'left' ? -200 : 200;
    ref.current.scrollBy({ left: amount, behavior: 'smooth' });
  };

  const handleScroll = () => {
    if (!ref.current) return;
    setShowLeft(ref.current.scrollLeft > 10);
    setShowRight(ref.current.scrollLeft < ref.current.scrollWidth - ref.current.clientWidth - 10);
  };

  return (
    <div className="relative">
      {showLeft && (
        <button onClick={() => scroll('left')}
          className="absolute left-0 top-0 bottom-0 z-10 px-2 bg-gradient-to-r from-background to-transparent">
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
      )}
      <div ref={ref} onScroll={handleScroll}
        className="flex gap-2 overflow-x-auto hide-scrollbar py-3 px-1">
        {allCats.map(cat => (
          <button key={cat.id} onClick={() => onSelect(cat.id)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-pill text-sm font-medium transition-all duration-200 backdrop-blur-sm ${
              activeId === cat.id
                ? 'bg-foreground/90 text-background'
                : 'bg-secondary/60 text-secondary-foreground hover:bg-secondary/80'
            }`}>
            {cat.name}
          </button>
        ))}
      </div>
      {showRight && (
        <button onClick={() => scroll('right')}
          className="absolute right-0 top-0 bottom-0 z-10 px-2 bg-gradient-to-l from-background to-transparent">
          <ChevronRight className="w-5 h-5 text-foreground" />
        </button>
      )}
    </div>
  );
}
