import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import Footer from './Footer';

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar open={sidebarOpen} collapsed={false} isMobile={isMobile} onClose={() => setSidebarOpen(false)} />
      <main className="pt-14 flex-1 transition-all duration-300">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

