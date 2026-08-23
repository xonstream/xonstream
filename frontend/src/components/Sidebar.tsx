import { Link, useLocation } from 'react-router-dom';
import { Home, Flame, TrendingUp, ThumbsUp, Tv, Users, Bell, Clock, X } from 'lucide-react';

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
  { to: '/liked', icon: ThumbsUp, label: 'Liked Videos' },
  { to: '/channels', icon: Tv, label: 'Channels' },
  { to: '/actors', icon: Users, label: 'Actors' },
  { to: '/subscriptions', icon: Bell, label: 'Subscriptions' },
  { to: '/history', icon: Clock, label: 'History' },
];

export default function Sidebar({ open, collapsed, isMobile, onClose }: SidebarProps) {
  const location = useLocation();

  if (!open) return null;

  const width = collapsed && !isMobile ? 'w-[72px]' : 'w-64';

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      <aside 
        className={`fixed top-14 left-0 bottom-0 z-40 ${width} bg-sidebar/95 backdrop-blur-xl border-r border-sidebar-border overflow-y-auto hide-scrollbar transition-all duration-300 shadow-2xl animate-in slide-in-from-left duration-300 ease-out`}
      >
        <div className="flex items-center justify-between p-3 border-b border-sidebar-border/50">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2">Navigation</span>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-xl hover:bg-sidebar-accent text-sidebar-foreground transition-all hover:scale-105 active:scale-95"
            title="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="py-3 px-2 space-y-1">
          {mainLinks.map(link => {
            const isActive = location.pathname === link.to || (link.to === '/liked' && location.pathname === '/favourites');
            return (
              <Link 
                key={link.to} 
                to={link.to} 
                onClick={onClose}
                className={`flex items-center gap-4 px-3.5 py-2.5 rounded-xl transition-all duration-200 group ${
                  isActive 
                    ? 'bg-accent text-white font-bold shadow-md shadow-accent/25' 
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/80 hover:text-accent'
                }`}
              >
                <link.icon className={`w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-muted-foreground group-hover:text-accent'}`} />
                {(!collapsed || isMobile) && <span className="text-sm tracking-wide">{link.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
