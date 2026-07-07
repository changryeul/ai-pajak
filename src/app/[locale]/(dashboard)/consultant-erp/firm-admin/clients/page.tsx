import { Building2 } from 'lucide-react';
import { FirmAdminClientsView } from '@/components/consultant-erp/firm-admin/FirmAdminClientsView';

export default function FirmAdminClientsPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-700 p-6 md:p-8 text-white mb-6">
        <p className="text-indigo-100 text-sm flex items-center gap-2">
          <Building2 className="h-4 w-4" />세무 컨설팅 법인 관리
        </p>
        <h1 className="text-2xl md:text-3xl font-bold mt-1">클라이언트 관리</h1>
        <p className="text-indigo-100 text-sm mt-1">
          자기 회사의 클라이언트를 소속 직원에게 배정·재배정
        </p>
      </div>

      <FirmAdminClientsView />
    </div>
  );
}
