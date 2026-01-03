import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, FileText, Upload, Clock, CheckCircle, CheckCircle2, Send, Users, MessageSquare, Settings, UserCheck, Shield, Wallet } from 'lucide-react';

// User roles as defined in the PRD
export type UserRole = 'CUSTOMER' | 'CONSULTANT_JTC' | 'TAX_ADVISOR_JTC' | 'PLATFORM_ADMIN' | 'SYSTEM';

export interface MenuItem {
  id: string;
  labelKey: string; // Translation key for i18n
  path: string;
  icon: LucideIcon;
  roles: UserRole[];
  children?: MenuItem[];
}

/**
 * Main navigation menu configuration
 * Role-based access control is applied via the roles array
 * Labels use translation keys (e.g., 'sidebar.dashboard') for i18n support
 */
export const menuConfig: MenuItem[] = [
  // Dashboard - Available to all authenticated users except SYSTEM
  {
    id: 'dashboard',
    labelKey: 'sidebar.dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
    roles: ['CUSTOMER', 'CONSULTANT_JTC', 'TAX_ADVISOR_JTC', 'PLATFORM_ADMIN'],
  },

  // Tax Cases - For CUSTOMER and JTC staff
  {
    id: 'tax-cases',
    labelKey: 'sidebar.taxFiling',
    path: '/tax-cases',
    icon: FileText,
    roles: ['CUSTOMER', 'CONSULTANT_JTC', 'TAX_ADVISOR_JTC'],
    children: [
      {
        id: 'upload',
        labelKey: 'sidebar.uploadDocuments',
        path: '/tax-cases/upload',
        icon: Upload,
        roles: ['CUSTOMER'],
      },
      {
        id: 'in-progress',
        labelKey: 'sidebar.inProgress',
        path: '/tax-cases/in-progress',
        icon: Clock,
        roles: ['CUSTOMER', 'CONSULTANT_JTC'],
      },
      {
        id: 'completed',
        labelKey: 'sidebar.completed',
        path: '/tax-cases/completed',
        icon: CheckCircle,
        roles: ['CUSTOMER', 'CONSULTANT_JTC'],
      },
    ],
  },

  // Customer Management - For Consultant
  {
    id: 'customers',
    labelKey: 'sidebar.customers',
    path: '/customers',
    icon: Users,
    roles: ['CONSULTANT_JTC'],
  },

  // Tax Processing - For Consultant
  {
    id: 'tax-processing',
    labelKey: 'sidebar.taxProcessing',
    path: '/tax-processing',
    icon: UserCheck,
    roles: ['CONSULTANT_JTC'],
  },

  // Communication - For Consultant
  {
    id: 'communication',
    labelKey: 'sidebar.communication',
    path: '/communication',
    icon: MessageSquare,
    roles: ['CONSULTANT_JTC'],
  },

  // Approval Queue - For Tax Advisor only
  {
    id: 'approval-queue',
    labelKey: 'sidebar.approvalQueue',
    path: '/approval-queue',
    icon: CheckCircle2,
    roles: ['TAX_ADVISOR_JTC'],
  },

  // Bulk Submit - For Tax Advisor only
  {
    id: 'bulk-submit',
    labelKey: 'sidebar.bulkSubmit',
    path: '/bulk-submit',
    icon: Send,
    roles: ['TAX_ADVISOR_JTC'],
  },

  // Team Management - For Tax Advisor only
  {
    id: 'team',
    labelKey: 'sidebar.team',
    path: '/team',
    icon: Shield,
    roles: ['TAX_ADVISOR_JTC'],
  },

  // Payment - For Customer
  {
    id: 'payment',
    labelKey: 'sidebar.payment',
    path: '/payment',
    icon: Wallet,
    roles: ['CUSTOMER'],
  },

  // Settings - Available to all authenticated users
  {
    id: 'settings',
    labelKey: 'sidebar.settings',
    path: '/settings',
    icon: Settings,
    roles: ['CUSTOMER', 'CONSULTANT_JTC', 'TAX_ADVISOR_JTC', 'PLATFORM_ADMIN'],
  },
];

/**
 * Get filtered menu items for a specific user role
 * @param role - The user's role
 * @returns Array of menu items accessible to the given role
 */
export function getMenuForRole(role: UserRole): MenuItem[] {
  return menuConfig
    .filter((item) => item.roles.includes(role))
    .map((item) => ({
      ...item,
      children: item.children?.filter((child) => child.roles.includes(role)),
    }));
}

/**
 * Check if a path is active based on current location
 * @param path - The menu item path
 * @param currentPath - The current browser path
 * @returns Whether the path should be considered active
 */
export function isPathActive(path: string, currentPath: string): boolean {
  if (path === '/dashboard') {
    return currentPath === '/dashboard';
  }
  return currentPath === path || currentPath.startsWith(path + '/');
}
