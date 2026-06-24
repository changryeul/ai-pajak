'use client';

import { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { Input } from '@/components/ui/input';

/**
 * 2026-06-24: 천 단위 구분 자동 표시 입력 컴포넌트.
 *
 * - blur 상태에서는 현재 locale 의 천 단위 구분 (ko/en: comma, id: 마침표)
 *   으로 표시. focus 하면 raw 숫자만 보여 사용자 편집 편의.
 * - onBlur 시점에 raw 숫자를 onCommit 으로 전달.
 *
 * 기존 inline edit `<Input type="number" defaultValue={x} onBlur={...} />`
 * 패턴을 그대로 대체할 수 있도록 동작 모방.
 */
export interface NumberInputProps
  extends Omit<
    React.ComponentProps<'input'>,
    'type' | 'value' | 'defaultValue' | 'onBlur' | 'onChange' | 'onFocus'
  > {
  value: number | string | null | undefined;
  onCommit?: (n: number) => void;
}

export function NumberInput({ value, onCommit, className, ...rest }: NumberInputProps) {
  const locale = useLocale();
  const lc = locale === 'id' ? 'id-ID' : locale === 'ko' ? 'ko-KR' : locale;
  const n = Number(value ?? 0) || 0;
  const formatted = n.toLocaleString(lc);

  const [display, setDisplay] = useState<string>(formatted);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDisplay(formatted);
  }, [formatted, focused]);

  return (
    <Input
      type="text"
      inputMode="numeric"
      className={className}
      {...rest}
      value={display}
      onChange={(e) => setDisplay(e.target.value)}
      onFocus={() => {
        setFocused(true);
        // focus 시 raw 표시 (구분자 제거) 후 selection 편의
        setDisplay(String(n));
      }}
      onBlur={() => {
        setFocused(false);
        const parsed = Number(display.replace(/[^\d-]/g, '') || 0);
        onCommit?.(parsed);
        setDisplay(parsed.toLocaleString(lc));
      }}
    />
  );
}
