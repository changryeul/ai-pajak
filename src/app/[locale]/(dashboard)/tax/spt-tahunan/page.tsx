'use client';

import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Building2,
  Briefcase,
  User,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';

interface SPTFormOption {
  id: string;
  title: string;
  description: string;
  targetAudience: string;
  icon: React.ElementType;
  href: string;
  features: string[];
  color: string;
}

const sptForms: SPTFormOption[] = [
  {
    id: '1770ss',
    title: 'SPT 1770 SS',
    description: 'Formulir Sangat Sederhana',
    targetAudience: 'Karyawan dengan penghasilan bruto < Rp 60 juta/tahun dari satu pemberi kerja',
    icon: User,
    href: '/tax/spt-tahunan/1770ss',
    features: [
      'Penghasilan dari satu pemberi kerja',
      'Penghasilan bruto < Rp 60 juta',
      'Tidak ada penghasilan lain',
    ],
    color: 'bg-green-50 border-green-200 hover:border-green-400',
  },
  {
    id: '1770s',
    title: 'SPT 1770 S',
    description: 'Formulir Sederhana',
    targetAudience: 'Karyawan dengan penghasilan bruto >= Rp 60 juta atau dari lebih dari satu pemberi kerja',
    icon: FileText,
    href: '/tax/spt-tahunan/1770s',
    features: [
      'Penghasilan dari satu atau lebih pemberi kerja',
      'Penghasilan bruto >= Rp 60 juta',
      'Penghasilan lain (bunga, dividen, dll)',
    ],
    color: 'bg-blue-50 border-blue-200 hover:border-blue-400',
  },
  {
    id: '1770',
    title: 'SPT 1770',
    description: 'Formulir Lengkap',
    targetAudience: 'Wajib pajak dengan penghasilan dari usaha atau pekerjaan bebas',
    icon: Briefcase,
    href: '/tax/spt-tahunan/1770',
    features: [
      'Penghasilan dari usaha',
      'Pekerjaan bebas (dokter, pengacara, dll)',
      'Pembukuan atau Norma',
      'Kompensasi kerugian',
    ],
    color: 'bg-purple-50 border-purple-200 hover:border-purple-400',
  },
  {
    id: '1771',
    title: 'SPT 1771',
    description: 'Formulir Badan',
    targetAudience: 'Wajib pajak badan (PT, CV, Firma, Koperasi, Yayasan)',
    icon: Building2,
    href: '/tax/spt-tahunan/1771',
    features: [
      'Tarif PPh Badan 22%',
      'Tarif UMKM 11% (omzet < Rp 50 miliar)',
      'Koreksi fiskal',
      'Kompensasi kerugian 10 tahun',
    ],
    color: 'bg-orange-50 border-orange-200 hover:border-orange-400',
  },
];

export default function SPTTahunanPage() {
  const t = useTranslations('tax');
  const params = useParams();
  const router = useRouter();
  const locale = params.locale as string;

  const handleSelectForm = (form: SPTFormOption) => {
    router.push(`/${locale}${form.href}`);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {t('sptTahunan.title')}
        </h1>
        <p className="text-gray-600 mt-1">
          Pilih jenis formulir SPT Tahunan yang sesuai dengan kondisi Anda
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sptForms.map((form) => {
          const Icon = form.icon;

          return (
            <Card
              key={form.id}
              className={`cursor-pointer transition-all duration-200 border-2 ${form.color}`}
              onClick={() => handleSelectForm(form)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white shadow-sm">
                      <Icon className="h-6 w-6 text-gray-700" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{form.title}</CardTitle>
                      <CardDescription className="text-sm">
                        {form.description}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  {form.targetAudience}
                </p>

                <div className="space-y-2 mb-4">
                  {form.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>

                <Button className="w-full" variant="outline">
                  Pilih {form.title}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Help Section */}
      <Card className="mt-8 bg-gray-50">
        <CardContent className="py-6">
          <h3 className="font-semibold text-gray-900 mb-2">
            Tidak yakin formulir mana yang harus digunakan?
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Sistem kami dapat membantu menentukan formulir yang tepat berdasarkan
            data penghasilan Anda. Upload Bukti Potong (Form 1721-A1) Anda dan kami
            akan merekomendasikan formulir yang sesuai.
          </p>
          <Button variant="outline" onClick={() => router.push(`/${locale}/documents`)}>
            Upload Bukti Potong
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
