import nextDynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/header';
import { MobileSidebarProvider } from '@/components/layout/mobile-sidebar';

const Sidebar = nextDynamic(
  () => import('@/components/layout/sidebar').then(m => ({ default: m.Sidebar })),
  { ssr: false }
);

// Force dynamic rendering - dashboard requires authentication
export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <MobileSidebarProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Sidebar />
        <div className="lg:ml-64">
          <Header
            userEmail={user?.email}
            userName={user?.user_metadata?.full_name}
          />
          <main className="p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </MobileSidebarProvider>
  );
}
