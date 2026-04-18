import Link from 'next/link';
import { FileQuestion, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <html lang="id">
      <body className="bg-gray-50">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FileQuestion className="h-8 w-8 text-blue-500" />
            </div>
            <p className="text-xs font-mono text-gray-400 mb-2">404</p>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Halaman tidak ditemukan
            </h1>
            <p className="text-sm text-gray-500 mb-6">
              Halaman yang Anda cari tidak tersedia atau telah dipindahkan.
            </p>
            <Link
              href="/id/dashboard"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white text-sm font-medium hover:bg-blue-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Dasbor
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
