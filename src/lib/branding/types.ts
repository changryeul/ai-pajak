/**
 * White-Label Branding Types
 *
 * Allows tax consultants to customize the client portal with their own branding.
 */

export interface BrandingConfig {
  id: string;
  consultantId: string;
  companyName: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor: string; // hex
  secondaryColor: string; // hex
  accentColor: string; // hex
  tagline?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  footerText?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_BRANDING: Omit<BrandingConfig, 'id' | 'consultantId' | 'createdAt' | 'updatedAt'> = {
  companyName: 'AI Pajak',
  primaryColor: '#2563eb',
  secondaryColor: '#4f46e5',
  accentColor: '#eab308',
  tagline: 'Platform Pajak Cerdas',
  isActive: false,
};
