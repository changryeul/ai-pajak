import path from 'path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Pin Turbopack to this project so Next 16 doesn't infer the wrong
  // workspace root when multiple lockfiles exist on the machine.
  turbopack: {
    root: path.resolve(__dirname),
  },

  // Include role-based user manuals in the serverless function bundle so
  // /help/manuals/[role] can read them via fs.readFile at runtime on Vercel.
  outputFileTracingIncludes: {
    '/[locale]/help/manuals/[role]': ['./docs/manuals/*.md'],
  },

  // Image optimization configuration
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },

  // Environment variables validation
  env: {
    NEXT_PUBLIC_APP_NAME: 'AI PAJAK',
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },

  // Experimental features
  experimental: {
    // Enable server actions
    serverActions: {
      bodySizeLimit: '10mb', // For file uploads
    },
    // Optimize package imports - tree-shake large libraries
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      'date-fns',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-select',
      '@radix-ui/react-tabs',
      '@radix-ui/react-popover',
    ],
  },

  // Compression
  compress: true,

  // Headers for caching
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/fonts/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
    ];
  },

  // Webpack configuration for handling specific modules
  webpack: (config, { webpack }) => {
    // Handle canvas module for PDF generation (if needed)
    config.externals = [...(config.externals || []), { canvas: 'canvas' }];
    // Tree-shake Sentry SDK debug logging. Replaces the deprecated
    // `disableLogger: true` option passed to withSentryConfig — same
    // bundle behaviour (drops Sentry's internal console.log calls), but
    // via webpack DefinePlugin which is the Sentry-recommended path.
    config.plugins.push(
      new webpack.DefinePlugin({
        __SENTRY_DEBUG__: false,
      }),
    );
    return config;
  },
};

// Wrap with Sentry
export default withSentryConfig(withNextIntl(nextConfig), {
  org: 'ai-pajak',
  project: 'ai-pajak',
  silent: true,
  widenClientFileUpload: true,
});
