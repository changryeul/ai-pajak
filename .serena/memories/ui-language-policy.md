# UI Language Policy (Updated: i18n Required)

## CRITICAL: i18n 시스템 필수 사용

**Story 1-7 완료 이후, 모든 UI 텍스트는 반드시 react-i18next를 통해 처리해야 합니다.**

### 사용 방법

```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation('namespace'); // common, navigation, dashboard, errors
  
  return <button>{t('buttons.save')}</button>;
}
```

### 네임스페이스 구조

- `common` - 공통 UI (버튼, 레이블, 메시지, 상태)
- `navigation` - 사이드바, 헤더, 메뉴
- `dashboard` - 대시보드 관련 텍스트
- `errors` - 에러 메시지

### 번역 파일 위치

```
apps/web/src/i18n/locales/
├── en/  (English - 기본)
├── ko/  (Korean)
└── id/  (Indonesian)
```

### 새 번역 키 추가 시

1. 해당 네임스페이스의 JSON 파일에 키 추가
2. **3개 언어 (en, ko, id) 모두에 추가 필수**
3. TypeScript 타입 안전성을 위해 `src/i18n/types.ts` 업데이트 권장

### 금지 사항

- ❌ 하드코딩된 UI 텍스트 사용 금지
- ❌ `<button>저장</button>`
- ✅ `<button>{t('buttons.save')}</button>`

---

## 기존 정책 (참고용)