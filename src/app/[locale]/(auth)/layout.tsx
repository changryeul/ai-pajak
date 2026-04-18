import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher';

/**
 * Auth-routes layout (login / register / forgot-password / reset-password / invite).
 *
 * The sole shared element is a top-right locale switcher so users can pick
 * their language BEFORE signing in. Without this, a Korean expat landing
 * on /id/login (the default-locale URL shared in marketing) had no way to
 * switch to /ko before completing onboarding.
 */

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <div className="absolute top-4 right-4 z-50 rounded-lg bg-white/70 backdrop-blur border border-gray-200/60 shadow-sm">
        <LocaleSwitcher alignLeft />
      </div>
      {children}
    </div>
  );
}
