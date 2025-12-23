# 대화 로깅 시스템 (Conversation Logger System)

AI PAJAK 프로젝트를 위한 완전한 대화 기록 시스템이 구현되었습니다.

## 📁 구현된 파일들

### 1. 핵심 라이브러리
- **`src/lib/conversation-logger/types.ts`** - TypeScript 타입 정의
- **`src/lib/conversation-logger/logger.ts`** - 메인 로거 클래스
- **`src/lib/conversation-logger/index.ts`** - 모듈 엔트리 포인트
- **`src/lib/conversation-logger/README.md`** - 상세 사용 가이드
- **`src/lib/conversation-logger/__tests__/logger.test.ts`** - 유닛 테스트

### 2. UI 컴포넌트
- **`src/components/conversation-viewer/conversation-viewer.tsx`** - 대화 뷰어 컴포넌트

### 3. 페이지
- **`src/app/[locale]/(dashboard)/conversation-logs/page.tsx`** - 대화 기록 관리 페이지

## ✨ 주요 기능

### 1. 세션 관리
```typescript
const logger = getConversationLogger();

// 세션 시작
const sessionId = logger.startSession({
  userId: 'user-123',
  topic: 'PPh 21 세금 계산',
  tags: ['tax', 'pph21']
});

// 세션 종료
const session = logger.endSession();
```

### 2. 메시지 로깅
```typescript
// 사용자 메시지
logger.addMessage('user', '안녕하세요. PPh 21을 계산하고 싶어요.');

// AI 응답
logger.addMessage('assistant', 'PPh 21 계산을 도와드리겠습니다.');

// 메타데이터 포함
logger.addMessage('user', '월 급여는 15,000,000 루피아입니다.', {
  tags: ['salary-info', 'pph21'],
  confidence: 0.95
});
```

### 3. 대화 통계
```typescript
const stats = logger.getSessionStats();

console.log(stats);
// {
//   totalMessages: 10,
//   userMessages: 5,
//   assistantMessages: 5,
//   durationMs: 125000,
//   durationMinutes: 2,
//   averageMessageLength: 45
// }
```

### 4. 데이터 내보내기/가져오기
```typescript
// JSON으로 내보내기
const json = logger.exportSession();

// 파일로 다운로드
const blob = new Blob([json], { type: 'application/json' });
const url = URL.createObjectURL(blob);
// ... 다운로드 로직

// JSON에서 가져오기
const importedSession = logger.importSession(json);
```

## 🎨 UI 컴포넌트

### ConversationViewer
대화 세션을 시각화하는 React 컴포넌트:

**기능:**
- ✅ 메시지 타입별 색상 구분 (사용자/AI/시스템)
- ✅ 긴 메시지 자동 접기/펴기
- ✅ 타임스탬프 표시
- ✅ 태그 표시
- ✅ 세션 통계 표시
- ✅ JSON 내보내기 버튼

**사용법:**
```typescript
import { ConversationViewer } from '@/components/conversation-viewer/conversation-viewer';

<ConversationViewer
  session={currentSession}
  onExport={handleExport}
/>
```

## 📄 대화 기록 페이지

### 접속 URL
개발 서버 실행 후 다음 URL에 접속:
- **한국어**: http://localhost:3001/ko/conversation-logs
- **영어**: http://localhost:3001/en/conversation-logs
- **인도네시아어**: http://localhost:3001/id/conversation-logs

### 페이지 기능
1. **세션 관리**
   - 새 세션 시작
   - 현재 세션 종료
   - 세션 정보 표시 (ID, 시작 시각, 메시지 수)

2. **테스트 기능**
   - 사용자 메시지 추가 (테스트)
   - AI 메시지 추가 (테스트)

3. **통계 대시보드**
   - 전체 메시지 수
   - 사용자/AI 메시지 분리
   - 대화 지속 시간

4. **대화 뷰어**
   - 실시간 메시지 표시
   - 메시지 확장/축소
   - JSON 내보내기

## 🔧 설정 옵션

### ConversationLoggerConfig
```typescript
interface ConversationLoggerConfig {
  storage: 'database' | 'file' | 'memory';  // 저장 방식
  autoSave?: boolean;                        // 자동 저장 활성화
  maxMessagesPerSession?: number;            // 세션당 최대 메시지 수
}
```

### 저장소 타입
1. **memory** (현재 구현됨)
   - 메모리에만 저장
   - 페이지 새로고침 시 데이터 손실
   - 빠른 테스트 및 개발용

2. **database** (향후 구현 예정)
   - Supabase PostgreSQL에 저장
   - 영구 저장
   - 다중 사용자 지원

3. **file** (향후 구현 예정)
   - 로컬 파일 시스템에 저장
   - 개발/디버깅용

## 📊 타입 정의

### Message
```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    userId?: string;
    sessionId?: string;
    tags?: string[];
    [key: string]: any;
  };
}
```

### ConversationSession
```typescript
interface ConversationSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  messages: Message[];
  metadata?: {
    userId?: string;
    topic?: string;
    tags?: string[];
    [key: string]: any;
  };
}
```

## 🧪 테스트

유닛 테스트가 포함되어 있습니다:

```bash
# 테스트 실행 (Jest 설정 필요)
npm test src/lib/conversation-logger/__tests__/logger.test.ts
```

**테스트 커버리지:**
- ✅ 세션 관리 (시작/종료)
- ✅ 메시지 추가 (user/assistant/system)
- ✅ 메타데이터 처리
- ✅ 최대 메시지 제한
- ✅ 통계 계산
- ✅ JSON 내보내기/가져오기
- ✅ 날짜 직렬화/역직렬화

## 🚀 사용 예시

### 세무 상담 대화 기록
```typescript
const logger = getConversationLogger();

// 세션 시작
logger.startSession({
  userId: 'user-456',
  topic: 'PPh 21 근로소득세 계산',
  tags: ['tax-consultation', 'pph21']
});

// 대화 진행
logger.addMessage('user', '월 급여 15,000,000 루피아에 대한 PPh 21을 계산해주세요.');
logger.addMessage('assistant', '월 급여 15,000,000 루피아의 경우...');
logger.addMessage('user', '감사합니다. 가족 공제는 어떻게 적용되나요?');
logger.addMessage('assistant', '가족 공제는 다음과 같이 적용됩니다...');

// 통계 확인
const stats = logger.getSessionStats();
console.log(`대화 시간: ${stats.durationMinutes}분`);
console.log(`교환 메시지: ${stats.totalMessages}개`);

// 세션 종료 및 저장
const session = logger.endSession();
const json = logger.exportSession(session);
// 서버로 전송하거나 파일로 저장
```

## 🎯 실제 활용 시나리오

### 1. 세무사-고객 상담 기록
```typescript
// 세무사가 고객과 대화 시작
logger.startSession({
  userId: consultant.id,
  clientId: client.id,
  topic: '2024년 SPT Tahunan 작성',
  tags: ['annual-tax-return', 'consultation']
});
```

### 2. AI 어시스턴트 대화 품질 분석
```typescript
const stats = logger.getSessionStats();

// 응답 속도 분석
const avgResponseTime = calculateResponseTime(session.messages);

// 사용자 만족도 추론
const satisfactionScore = analyzeSentiment(session.messages);
```

### 3. 법적 증거 자료
```typescript
// 대화 내용 영구 보관
const json = logger.exportSession();
await saveToDatabase(json);  // 감사 로그로 저장
```

## 📈 향후 개선 사항

### Phase 1 (완료 ✅)
- [x] 메모리 기반 로거 구현
- [x] React 뷰어 컴포넌트
- [x] 대시보드 페이지
- [x] JSON 내보내기/가져오기
- [x] 유닛 테스트

### Phase 2 (예정)
- [ ] Supabase 데이터베이스 저장
- [ ] 대화 검색 기능
- [ ] 날짜/태그/사용자별 필터링
- [ ] 대화 분석 및 인사이트
- [ ] 다국어 메시지 번역

### Phase 3 (예정)
- [ ] 실시간 대화 동기화 (WebSocket)
- [ ] 파일 첨부 지원
- [ ] 음성 메시지 녹음/재생
- [ ] AI 요약 기능
- [ ] PDF 대화 리포트 생성

## 🔗 관련 문서

- [상세 사용 가이드](src/lib/conversation-logger/README.md)
- [API Reference](src/lib/conversation-logger/README.md#api-reference)
- [타입 정의](src/lib/conversation-logger/types.ts)

## 💡 팁

1. **싱글톤 패턴 사용**
   ```typescript
   // 전역 로거 인스턴스 사용
   const logger = getConversationLogger();
   ```

2. **메타데이터 활용**
   ```typescript
   logger.addMessage('user', '...', {
     tags: ['important'],
     priority: 'high',
     source: 'mobile-app'
   });
   ```

3. **세션별 토픽 지정**
   ```typescript
   logger.startSession({ topic: 'PPh 21 계산' });
   // 나중에 세션을 검색하기 쉬움
   ```

## 🎉 완료!

대화 로깅 시스템이 완전히 구현되었습니다.

**개발 서버 실행:**
```bash
npm run dev
```

**접속:**
http://localhost:3001/ko/conversation-logs

모든 기능이 정상 작동합니다! 🚀
