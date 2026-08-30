'use client';
import { useCallback, useEffect, useState } from 'react';

/**
 * 고객 데이터 폼의 필수항목(MASTER 관리) 소비 훅.
 * form 컴포넌트가 별표(*) 표시 + 빈 값 입력유도에 사용. (2026-08-30)
 */
export interface RequiredFieldDef { fieldKey: string; label: string; isRequired: boolean }

export function useRequiredFields(formKey: string) {
  const [fields, setFields] = useState<RequiredFieldDef[]>([]);
  const [requiredKeys, setRequiredKeys] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    fetch(`/api/required-fields?formKey=${encodeURIComponent(formKey)}`)
      .then(r => r.json())
      .then(j => { if (alive && j.success) { setFields(j.data.fields); setRequiredKeys(j.data.requiredKeys); } })
      .catch(() => {});
    return () => { alive = false; };
  }, [formKey]);

  const isRequired = useCallback((k: string) => requiredKeys.includes(k), [requiredKeys]);

  // values 객체에서 필수인데 비어 있는 항목 목록 (입력유도용).
  // 폼이 실제로 다루는 키만 평가한다(values 에 존재하는 키). 폼에 없는 필수필드는
  // 해당 폼에서 입력할 수 없으므로 노이즈로 표시하지 않는다.
  const missing = useCallback((values: Record<string, unknown>) =>
    fields.filter(f => f.isRequired)
      .filter(f => Object.prototype.hasOwnProperty.call(values, f.fieldKey))
      .filter(f => {
        const v = values[f.fieldKey];
        return v == null || v === '' || (typeof v === 'number' && v === 0);
      }), [fields]);

  return { fields, requiredKeys, isRequired, missing };
}
