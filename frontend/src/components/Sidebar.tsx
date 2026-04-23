import { Link, useLocation } from 'react-router-dom';
import { Home, Flame, TrendingUp, Star, Tv, Users, Bell, Clock, X } from 'lucide-react';

interface SidebarProps {
  open: boolean;
  collapsed: boolean;
  isMobile: boolean;
  onClose: () => void;
}

const mainLinks = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/popular', icon: Flame, label: 'Popular Videos' },
  { to: '/trending', icon: TrendingUp, label: 'Trending Videos' },
  { to: '/favourites', icon: Star, label: 'My Favourites' },
  { to: '/channels', icon: Tv, label: 'Channels' },
  { to: '/actors', icon: Users, label: 'Actors' },
  { to: '/subscriptions', icon: Bell, label: 'Subscriptions' },
  { to: '/history', icon: Clock, label: 'History' },
];

export default function Sidebar({ open, collapsed, isMobile, onClose }: SidebarProps) {
  const location = useLocation();

  if (!open) return null;

  const width = collapsed && !isMobile ? 'w-[72px]' : 'w-60';

  return (
    <>
      <div className="fixed inset-0 bg-background/60 z-40" onClick={onClose} />
      <aside className={`fixed top-14 left-0 bottom-0 z-40 ${width} bg-sidebar border-r border-sidebar-border overflow-y-auto hide-scrollbar transition-all duration-300 animate-slide-in-left`}>
        <div className="flex justify-end p-2">
          <button onClick={onClose} className="p-2 rounded-full hover:bg-sidebar-accent transition-colors">
            <X className="w-5 h-5 text-sidebar-foreground" />
          </button>
        </div>

        <nav className="py-2">
          {mainLinks.map(link => {
            const isActive = location.pathname === link.to;
            return (
              <Link key={link.to} to={link.to} onClick={onClose}
                className={`flex items-center gap-5 px-4 py-2.5 mx-2 rounded-[12px] transition-colors duration-200 ${
                  isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                }`}>
                <link.icon className="w-5 h-5 flex-shrink-0" />
                {(!collapsed || isMobile) && <span className="text-sm">{link.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
