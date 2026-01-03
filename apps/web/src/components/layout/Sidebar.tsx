import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getMenuForRole, isPathActive, type MenuItem, type UserRole } from '@/config/navigation';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SidebarProps {
  userRole: UserRole;
  userName?: string;
  userEmail?: string;
}

interface SidebarItemProps {
  item: MenuItem;
  isActive: (path: string) => boolean;
  t: (key: string) => string;
}

function SidebarItem({ item, isActive, t }: SidebarItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasChildren = item.children && item.children.length > 0;
  const active = isActive(item.path);
  const Icon = item.icon;

  if (hasChildren) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
          <span className="flex items-center gap-3">
            <Icon className="h-4 w-4" />
            {t(item.labelKey)}
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 transition-transform',
              isOpen && 'rotate-180'
            )}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-4">
          <ul className="space-y-1 border-l border-border pl-3 pt-1">
            {item.children?.map((child) => (
              <li key={child.id}>
                <Link
                  to={child.path}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                    isActive(child.path)
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <child.icon className="h-4 w-4" />
                  {t(child.labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <Link
      to={item.path}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <Icon className="h-4 w-4" />
      {t(item.labelKey)}
    </Link>
  );
}

export function Sidebar({ userRole, userName, userEmail }: SidebarProps) {
  const { t } = useTranslation('navigation');
  const location = useLocation();
  const menuItems = getMenuForRole(userRole);

  const checkIsActive = (path: string) => isPathActive(path, location.pathname);

  const userInitial = userName?.charAt(0).toUpperCase() || 'U';

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-slate-50">
      {/* Logo Area */}
      <div className="flex h-14 items-center border-b px-4">
        <Link to="/dashboard" className="flex items-center gap-2">
          <span className="text-xl font-bold text-primary">AI Pajak</span>
        </Link>
      </div>

      {/* Navigation Menu */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav>
          <ul className="space-y-1">
            {menuItems.map((item) => (
              <li key={item.id}>
                <SidebarItem item={item} isActive={checkIsActive} t={t} />
              </li>
            ))}
          </ul>
        </nav>
      </ScrollArea>

      {/* User Profile Area */}
      <div className="border-t p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary">
              {userInitial}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium">
              {userName || t('header.user')}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {userEmail || userRole}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
