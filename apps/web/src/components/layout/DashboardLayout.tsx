import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { type UserRole } from '@/config/navigation';

interface DashboardLayoutProps {
  userRole: UserRole;
  userName?: string;
  userEmail?: string;
  notificationCount?: number;
  onLogout?: () => void;
  onSettingsClick?: () => void;
}

export function DashboardLayout({
  userRole,
  userName,
  userEmail,
  notificationCount = 0,
  onLogout,
  onSettingsClick,
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar - Hidden on mobile, visible on lg screens */}
      <div className="hidden lg:block">
        <Sidebar
          userRole={userRole}
          userName={userName}
          userEmail={userEmail}
        />
      </div>

      {/* Mobile Sidebar - Sheet overlay */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-60 p-0">
          <Sidebar
            userRole={userRole}
            userName={userName}
            userEmail={userEmail}
          />
        </SheetContent>
      </Sheet>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          userName={userName}
          userRole={userRole}
          notificationCount={notificationCount}
          onLogout={onLogout}
          onSettingsClick={onSettingsClick}
        />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
