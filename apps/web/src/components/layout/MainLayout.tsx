import { Outlet, Link } from 'react-router-dom';

interface MainLayoutProps {
  showHeader?: boolean;
}

/**
 * MainLayout - Layout for unauthenticated pages (login, signup, landing)
 * Simple layout without sidebar, just header and content area
 */
export function MainLayout({ showHeader = true }: MainLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Optional Header for public pages */}
      {showHeader && (
        <header className="sticky top-0 z-50 border-b bg-background">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <span className="text-xl font-bold text-primary">AI Pajak</span>
            </Link>

            {/* Navigation links for public pages */}
            <nav className="flex items-center gap-4">
              <Link
                to="/login"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                로그인
              </Link>
              <Link
                to="/signup"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                시작하기
              </Link>
            </nav>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} AI Pajak. Powered by Mono Flip Global.
            </p>
            <p className="text-xs text-muted-foreground">
              세금 신고 서비스는 Jakarta Tax Consulting에서 제공합니다.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
