/**
 * 직원 인사 기록 워크큐 검토 플래그 — 순수 함수.
 *
 * 직원 마스터(employee_payroll)가 PPh21 급여 계산의 입력이므로, 계산을
 * 틀리게 만들거나(잘못된 PTKP, 급여 0) 가산/식별에 영향 주는(무-NPWP,
 * NIK 누락) 필드를 검사한다. 퇴사(비활성) 직원은 이슈가 아니라 상태다.
 */

export interface EmployeeHrFlagInput {
  ptkpCategory: string | null;
  npwp: string | null;
  nik: string | null;
  grossSalary: number;
  hireDate: string | null;
  isActive: boolean;
}

export interface EmployeeHrFlags {
  level: 'red' | 'amber' | 'green';
  issues: string[];
  label: string;
}

// TK/K/KI + 0~3 — 구분자('/', '-', 공백) 허용. normalizePtkpCategory 는
// 미지값을 TK0 으로 보수적 fallback 하므로(계산 경로용), 검토 뷰에서는
// 원본 표기가 유효한지 자체 검사해 "고쳐야 할 원본"을 드러낸다.
const PTKP_PATTERN = /^(TK|K|KI)[\s/-]?[0-3]$/i;

export function evaluateEmployeeHrFlags(input: EmployeeHrFlagInput): EmployeeHrFlags {
  const red: string[] = [];
  const amber: string[] = [];

  const rawPtkp = (input.ptkpCategory ?? '').trim();
  if (!rawPtkp || !PTKP_PATTERN.test(rawPtkp)) {
    red.push(rawPtkp ? `유효하지 않은 PTKP (${rawPtkp})` : 'PTKP 미입력');
  }

  if (input.isActive) {
    if (input.grossSalary <= 0) red.push('급여 미입력');
    if (!input.npwp?.trim()) amber.push('무-NPWP (20% 가산)');
    if (!input.hireDate) amber.push('입사일 미입력');
  }
  if (!input.nik?.trim()) amber.push('NIK 미입력');

  const issues = [...red, ...amber];
  const level: EmployeeHrFlags['level'] = red.length > 0 ? 'red' : amber.length > 0 ? 'amber' : 'green';
  return { level, issues, label: issues[0] ?? '정상' };
}
