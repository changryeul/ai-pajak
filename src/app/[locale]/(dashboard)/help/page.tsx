'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Card, CardHeader, CardTitle, CardContent,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  HelpCircle, Search, ChevronDown, ChevronUp,
  FileSpreadsheet, Upload, Lightbulb, ShieldCheck, MessageCircle,
  Calendar, Users, CreditCard, Building2, Sparkles,
} from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const FAQ_DATA: FAQItem[] = [
  // Getting Started
  { category: 'Memulai', question: 'Bagaimana cara mendaftar di AI Pajak?', answer: 'Klik "Daftar" di halaman utama, isi email dan password, lalu verifikasi email Anda. Setelah login, ikuti wizard onboarding untuk memilih jenis wajib pajak Anda.' },
  { category: 'Memulai', question: 'Apa saja yang dibutuhkan untuk mulai menggunakan?', answer: 'Anda memerlukan: 1) NPWP (Nomor Pokok Wajib Pajak), 2) NIK (Nomor Induk Kependudukan), 3) Bukti Potong 1721-A1 dari pemberi kerja (untuk karyawan).' },
  { category: 'Memulai', question: 'Apakah AI Pajak gratis?', answer: 'Ya, tersedia paket gratis dengan fitur dasar (5 dokumen, 2 pelaporan). Untuk fitur lengkap termasuk AI, tersedia paket Basic (Rp 199K/bulan) dan Pro (Rp 499K/bulan).' },

  // SPT Filing
  { category: 'SPT Tahunan', question: 'Apa perbedaan SPT 1770 SS, 1770 S, dan 1770?', answer: '1770 SS: Untuk karyawan dengan penghasilan <Rp 60 juta dari satu pemberi kerja.\n1770 S: Untuk karyawan dengan penghasilan ≥Rp 60 juta atau lebih dari satu pemberi kerja.\n1770: Untuk pengusaha atau pekerja bebas (dokter, pengacara, dll).' },
  { category: 'SPT Tahunan', question: 'Bagaimana cara mengisi SPT otomatis?', answer: '1) Buka menu "SPT Tahunan" → pilih formulir\n2) Upload foto/PDF Bukti Potong 1721-A1\n3) AI akan otomatis membaca dan mengisi data\n4) Periksa data, sesuaikan jika perlu\n5) Klik "Generate SPT"' },
  { category: 'SPT Tahunan', question: 'Kapan batas waktu pelaporan SPT?', answer: 'SPT Tahunan Orang Pribadi: 31 Maret tahun berikutnya.\nSPT Tahunan Badan: 30 April tahun berikutnya.\nKeterlambatan dikenai denda Rp 100.000 (OP) atau Rp 1.000.000 (Badan).' },
  { category: 'SPT Tahunan', question: 'Apa itu Bukti Potong 1721-A1?', answer: 'Bukti Potong 1721-A1 adalah dokumen dari pemberi kerja yang berisi data gaji dan pajak yang sudah dipotong selama setahun. Biasanya diberikan di awal tahun atau bisa diminta ke bagian HRD/personalia.' },

  // AI Features
  { category: 'Fitur AI', question: 'Bagaimana AI OCR membaca dokumen?', answer: 'AI menggunakan teknologi Claude Vision untuk membaca teks dari foto/PDF dokumen pajak. Upload gambar yang jelas dan tidak terpotong untuk hasil terbaik. Akurasi rata-rata >95%.' },
  { category: 'Fitur AI', question: 'Apa itu Tax Savings Advisor?', answer: 'Fitur AI yang menganalisis data pajak Anda dan menemukan peluang penghematan yang sah secara hukum. Misalnya: optimasi PTKP, pemanfaatan zakat sebagai pengurang, atau tarif UMKM 0.5%.' },
  { category: 'Fitur AI', question: 'Bagaimana cara menggunakan AI Chatbot?', answer: 'Klik ikon chat (💬) di pojok kanan bawah halaman manapun. Tanyakan apapun tentang pajak Indonesia, dan AI akan menjawab berdasarkan peraturan terbaru.' },
  { category: 'Fitur AI', question: 'Apakah data saya aman?', answer: 'Ya. Data dienkripsi end-to-end, disimpan di server yang aman, dan dilindungi oleh Row Level Security (RLS). Admin platform TIDAK dapat mengakses data pajak Anda (Hard Rule #1).' },

  // UMKM
  { category: 'UMKM', question: 'Bagaimana cara menghitung PPh Final UMKM?', answer: 'PPh Final UMKM = 0.5% x Omzet Bruto. Berlaku untuk WP dengan omzet <Rp 4.8 miliar/tahun. Per PP 55/2022, Rp 500 juta pertama dibebaskan dari pajak.' },
  { category: 'UMKM', question: 'Kapan bayar PPh Final bulanan?', answer: 'PPh Final UMKM dibayar paling lambat tanggal 15 bulan berikutnya. Gunakan fitur Kalender Pajak untuk pengingat otomatis.' },
  { category: 'UMKM', question: 'Bagaimana cara import data dari Shopee/Tokopedia?', answer: 'Buka menu "E-commerce Import" → pilih platform → download CSV dari Seller Dashboard → upload CSV. AI akan otomatis menghitung omzet dan PPh Final.' },

  // Consultants
  { category: 'Konsultan', question: 'Bagaimana cara menambah klien?', answer: 'Klien mendaftar sendiri di AI Pajak, lalu membuat Surat Kuasa (POA) yang menunjuk Anda sebagai konsultan. Setelah POA aktif, klien akan muncul di dashboard Anda.' },
  { category: 'Konsultan', question: 'Apa itu Deteksi Anomali?', answer: 'Fitur AI yang menganalisis data klien untuk mendeteksi potensi risiko pemeriksaan pajak. Memeriksa 9 kategori: perubahan penghasilan, rasio pengurang, tarif efektif, dll.' },
  { category: 'Konsultan', question: 'Bagaimana cara membuat laporan klien?', answer: 'Buka menu "Laporan Klien (AI)" → pilih klien → pilih tahun → klik "Generate Laporan". AI akan membuat laporan komprehensif dengan analisis dan rekomendasi.' },

  // Payment
  { category: 'Pembayaran', question: 'Metode pembayaran apa saja yang diterima?', answer: 'Kami menerima: Bank Transfer (BCA, Mandiri, BNI, BRI), GoPay, OVO, DANA, Kartu Kredit/Debit, dan Virtual Account melalui Midtrans.' },
  { category: 'Pembayaran', question: 'Bagaimana cara upgrade paket?', answer: 'Buka menu "Billing" → pilih paket yang diinginkan → klik "Upgrade" → selesaikan pembayaran. Fitur baru langsung aktif setelah pembayaran berhasil.' },

  // Technical
  { category: 'Teknis', question: 'Browser apa yang didukung?', answer: 'Chrome, Firefox, Safari, Edge versi terbaru. Kami merekomendasikan Chrome untuk pengalaman terbaik.' },
  { category: 'Teknis', question: 'Apakah bisa digunakan di HP?', answer: 'Ya, AI Pajak responsif dan bisa digunakan di semua perangkat. Anda juga bisa menambahkannya sebagai PWA (Progressive Web App) di home screen HP.' },
  { category: 'Teknis', question: 'Bagaimana cara menghubungi support?', answer: 'Gunakan AI Chatbot untuk pertanyaan umum. Untuk bantuan teknis, email ke support@aipajak.com atau gunakan fitur Chat di menu "Pesan".' },
];

const CATEGORIES = [...new Set(FAQ_DATA.map(f => f.category))];

const categoryIcons: Record<string, typeof HelpCircle> = {
  'Memulai': Sparkles,
  'SPT Tahunan': FileSpreadsheet,
  'Fitur AI': Lightbulb,
  'UMKM': Building2,
  'Konsultan': Users,
  'Pembayaran': CreditCard,
  'Teknis': ShieldCheck,
};

const GUIDES = [
  { title: 'Panduan Pemula', desc: 'Langkah pertama menggunakan AI Pajak', icon: Sparkles, href: '#getting-started', gradient: 'from-blue-500 to-indigo-600' },
  { title: 'Upload Bukti Potong', desc: 'Cara upload dan OCR dokumen', icon: Upload, href: '#upload', gradient: 'from-purple-500 to-violet-600' },
  { title: 'SPT Auto-fill', desc: 'Isi SPT otomatis dengan AI', icon: FileSpreadsheet, href: '#spt', gradient: 'from-green-500 to-emerald-600' },
  { title: 'Hemat Pajak', desc: 'Temukan peluang penghematan', icon: Lightbulb, href: '#savings', gradient: 'from-amber-500 to-orange-500' },
  { title: 'Kalender Pajak', desc: 'Jangan lewatkan deadline', icon: Calendar, href: '#calendar', gradient: 'from-red-500 to-rose-500' },
  { title: 'AI Chatbot', desc: 'Tanya AI kapan saja', icon: MessageCircle, href: '#chatbot', gradient: 'from-cyan-500 to-blue-500' },
];

export default function HelpPage() {
  const [search, setSearch] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const toggle = (index: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  const filteredFAQ = FAQ_DATA.filter(f => {
    const matchSearch = !search || f.question.toLowerCase().includes(search.toLowerCase()) || f.answer.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !activeCategory || f.category === activeCategory;
    return matchSearch && matchCategory;
  });

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-4">
          <HelpCircle className="h-7 w-7 text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Pusat Bantuan</h1>
        <p className="text-gray-500 mt-1">Temukan jawaban untuk pertanyaan Anda</p>
      </div>

      {/* Search */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <Input
          placeholder="Cari pertanyaan..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-12 h-12 rounded-xl text-base border-0 shadow-sm bg-white"
        />
      </div>

      {/* Quick Guides */}
      {!search && !activeCategory && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-8">
          {GUIDES.map(g => {
            const Icon = g.icon;
            return (
              <div key={g.title} className="group rounded-xl border border-gray-200 bg-white p-4 hover:shadow-md transition-all cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${g.gradient} shadow-sm group-hover:scale-110 transition-transform`}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{g.title}</p>
                    <p className="text-xs text-gray-500">{g.desc}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${!activeCategory ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          Semua
        </button>
        {CATEGORIES.map(cat => {
          const Icon = categoryIcons[cat] || HelpCircle;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeCategory === cat ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {cat}
            </button>
          );
        })}
      </div>

      {/* FAQ List */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0 divide-y">
          {filteredFAQ.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Tidak ditemukan. Coba kata kunci lain atau tanya AI Chatbot.</p>
            </div>
          ) : (
            filteredFAQ.map((faq, i) => {
              const isExpanded = expandedItems.has(i);
              return (
                <button
                  key={i}
                  onClick={() => toggle(i)}
                  className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{faq.category}</span>
                      </div>
                      <p className="font-medium text-sm text-gray-900">{faq.question}</p>
                      {isExpanded && (
                        <p className="text-sm text-gray-600 mt-2 whitespace-pre-line leading-relaxed">{faq.answer}</p>
                      )}
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1" /> : <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1" />}
                  </div>
                </button>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Still need help */}
      <Card className="mt-6 border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardContent className="p-6 text-center">
          <MessageCircle className="h-8 w-8 text-blue-600 mx-auto mb-2" />
          <h3 className="font-semibold text-gray-900">Masih butuh bantuan?</h3>
          <p className="text-sm text-gray-600 mt-1">Gunakan AI Chatbot di pojok kanan bawah atau email ke support@aipajak.com</p>
        </CardContent>
      </Card>
    </div>
  );
}
