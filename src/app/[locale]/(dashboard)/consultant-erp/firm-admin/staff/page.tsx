import { Users } from 'lucide-react';
import { FirmAdminStaffView } from '@/components/consultant-erp/firm-admin/FirmAdminStaffView';

export default function FirmAdminStaffPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-700 p-6 md:p-8 text-white mb-6">
        <p className="text-indigo-100 text-sm flex items-center gap-2">
          <Users className="h-4 w-4" />세무 컨설팅 법인 관리
        </p>
        <h1 className="text-2xl md:text-3xl font-bold mt-1">직원 관리</h1>
        <p className="text-indigo-100 text-sm mt-1">
          자기 회사 안의 컨설턴트·세무사 초대·비활성화·자격증 임명
        </p>
      </div>

      <FirmAdminStaffView />
    </div>
  );
}
