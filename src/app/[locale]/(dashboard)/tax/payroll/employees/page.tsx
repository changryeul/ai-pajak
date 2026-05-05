import EmployeeHrRecord from '@/components/payroll/EmployeeHrRecord';
import { PageTitle } from '@/components/layout/PageTitle';

export default function PayrollEmployeesPage() {
  return (
    <>
      <PageTitle title="AI Payroll · 인사기록" />
      <EmployeeHrRecord />
    </>
  );
}
