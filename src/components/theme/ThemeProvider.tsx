'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ReactNode } from 'react';

export function ThemeProvider({ children }: { children: ReactNode }) {
  // 2026-06-24: 화면 곳곳의 raw Tailwind color (bg-white / text-slate-700 등)
  // 가 dark variant 미보강이라 야간 모드 활성 시 글씨 가독성 떨어짐.
  // 일관성 갖춰진 dark 전체 지원 작업 전까지는 light 모드 강제.
  return (
    <NextThemesProvider attribute="class" defaultTheme="light" forcedTheme="light" enableSystem={false}>
      {children}
    </NextThemesProvider>
  );
}
