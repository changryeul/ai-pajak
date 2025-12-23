import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Image optimization configuration
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },

  // Environment variables validation
  env: {
    NEXT_PUBLIC_APP_NAME: 'AI PAJAK',
  },

  // Experimental features
  experimental: {
    // Enable server actions
    serverActions: {
      bodySizeLimit: '10mb', // For file uploads
    },
  },

  // Webpack configuration for handling specific modules
  webpack: (config) => {
    // Handle canvas module for PDF generation (if needed)
    config.externals = [...(config.externals || []), { canvas: 'canvas' }];
    return config;
  },
};

export default withNextIntl(nextConfig);
