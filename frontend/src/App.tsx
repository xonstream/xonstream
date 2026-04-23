import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, lazy, Suspense } from "react";
import { initTheme } from "@/lib/store";
import { detectDevice } from "@/lib/device";

// Lazy load components for better performance
const MainLayout = lazy(() => import("@/components/MainLayout"));
const HomePage = lazy(() => import("@/pages/HomePage"));
const WatchPage = lazy(() => import("@/pages/WatchPage"));
const ChannelPage = lazy(() => import("@/pages/ChannelPage"));
const ChannelsPage = lazy(() => import("@/pages/ChannelsPage"));
const ActorsPage = lazy(() => import("@/pages/ActorsPage"));
const ActorPage = lazy(() => import("@/pages/ActorPage"));
const SearchPage = lazy(() => import("@/pages/SearchPage"));
const PopularPage = lazy(() => import("@/pages/PopularPage"));
const TrendingPage = lazy(() => import("@/pages/TrendingPage"));
const FavouritesPage = lazy(() => import("@/pages/FavouritesPage"));
const SubscriptionsPage = lazy(() => import("@/pages/SubscriptionsPage"));
const HistoryPage = lazy(() => import("@/pages/HistoryPage"));
const SignInPage = lazy(() => import('@/pages/SignInPage'));
const SignUpPage = lazy(() => import('@/pages/SignUpPage'));
const AdminPage = lazy(() => import('@/pages/AdminPage'));
const AdminGate = lazy(() => import('@/pages/AdminGate'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const TermsPage = lazy(() => import("@/pages/TermsPage"));
const USC2257Page = lazy(() => import("@/pages/USC2257Page"));
const SupportPage = lazy(() => import("@/pages/SupportPage"));

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
    </div>
  );
}

const queryClient = new QueryClient();

// Scroll to top on every route change
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

function DeviceRedirect() {
  const location = useLocation();
  const device = detectDevice();
  
  // If already on a device path, validate it matches actual device
  const pathParts = location.pathname.split('/').filter(Boolean);
  const firstPart = pathParts[0];
  const validDevicePaths = ['pc', 'mobile', 'tablet', 'ios', 'ipad'];
  const specialPaths = ['meow', 'signin', 'signup', 'search'];
  
  // Allow special paths without redirect
  if (specialPaths.includes(firstPart)) {
    return null;
  }
  
  // If on a device path that doesn't match actual device, redirect to correct one
  if (validDevicePaths.includes(firstPart) && firstPart !== device) {
    // Replace the device prefix in the URL
    const restOfPath = location.pathname.substring(firstPart.length + 1);
    const search = location.search;
    return <Navigate to={`/${device}${restOfPath}${search}`} replace />;
  }
  
  // If not on any device path, redirect to device-specific path
  if (!validDevicePaths.includes(firstPart) && pathParts.length > 0) {
    return <Navigate to={`/${device}${location.pathname}`} replace />;
  }
  
  return null;
}

// All pages wrapped in main layout
const appRoutes = (
  <>
    <Route index element={<HomePage />} />
    <Route path="watch" element={<WatchPage />} />
    <Route path="video/:slug" element={<WatchPage />} />
    <Route path="channel/:channelId" element={<ChannelPage />} />
    <Route path="channels" element={<ChannelsPage />} />
    <Route path="actors" element={<ActorsPage />} />
    <Route path="actor/:actorId" element={<ActorPage />} />
    <Route path="search" element={<SearchPage />} />
    <Route path="popular" element={<PopularPage />} />
    <Route path="trending" element={<TrendingPage />} />
    <Route path="favourites" element={<FavouritesPage />} />
    <Route path="subscriptions" element={<SubscriptionsPage />} />
    <Route path="history" element={<HistoryPage />} />
    <Route path="terms" element={<TermsPage />} />
    <Route path="2257" element={<USC2257Page />} />
    <Route path="support" element={<SupportPage />} />
  </>
);

const App = () => {
  useEffect(() => { initTheme(); }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ScrollToTop />
          <DeviceRedirect />
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              {/* Root redirects to device-specific path */}
              <Route path="/" element={<MainLayout />}>
                {appRoutes}
              </Route>

              {/* 
                Device-specific routes: /pc, /mobile, /tablet, /ios, /ipad
                NOTE: These are NOT duplicate files - they're the SAME components rendered under different URL prefixes
                This allows device-based URL structure while reusing the same page components
                Example: /pc/actors and /mobile/actors both render ActorsPage component
              */}
              {['pc', 'mobile', 'tablet', 'ios', 'ipad'].map(device => (
                <Route key={device} path={`/${device}`} element={<MainLayout />}>
                  {appRoutes}
                </Route>
              ))}

              {/* Device-specific nested routes (catch-all for sub-paths) */}
              {['pc', 'mobile', 'tablet', 'ios', 'ipad'].map(device => (
                <Route key={`nested-${device}`} path={`/${device}/*`} element={<MainLayout />}>
                  {appRoutes}
                </Route>
              ))}

              {/* Auth pages (no layout) */}
              <Route path="/signin" element={<SignInPage />} />
              <Route path="/signup" element={<SignUpPage />} />

              {/* Admin routes */}
              <Route path="/meow" element={<AdminGate />} />
              <Route path="/meow/panel" element={<AdminPage />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
