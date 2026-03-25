import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { APP_NAME, APP_DESCRIPTION } from '@/config/constants';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import '@/app/globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  keywords: ['tax', 'pajak', 'indonesia', 'ai', 'pph21', 'ppn', 'spt'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`} suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
