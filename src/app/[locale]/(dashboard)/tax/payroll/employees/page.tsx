import { getTranslations } from 'next-intl/server';
import EmployeeHrRecord from '@/components/payroll/EmployeeHrRecord';
import { PageTitle } from '@/components/layout/PageTitle';

export default async function PayrollEmployeesPage() {
  const t = await getTranslations('employeeHr');
  return (
    <>
      <PageTitle title={t('pageTitle')} />
      <EmployeeHrRecord />
    </>
  );
}
