import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="mt-8 border-t border-border bg-background/80 backdrop-blur-sm">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-2 sm:py-3 flex flex-col sm:flex-row items-center justify-between gap-2">
        {/* Left — site name (hidden on mobile) */}
        <Link to="/" className="text-foreground font-bold text-sm sm:text-lg tracking-wide hover:text-primary transition-colors hidden sm:block">
          XON STREAM
        </Link>

        {/* Right — legal links */}
        <nav className="flex items-center justify-between sm:justify-end gap-3 sm:gap-6 text-xs sm:text-sm text-muted-foreground w-full sm:w-auto">
          <Link
            to="/terms"
            className="hover:text-foreground transition-colors"
          >
            Terms of Use
          </Link>
          <Link
            to="/2257"
            className="hover:text-foreground transition-colors"
          >
            18 U.S.C. 2257
          </Link>
          <Link
            to="/support"
            className="hover:text-foreground transition-colors"
          >
            Support
          </Link>
        </nav>
      </div>
    </footer>
  );
}
