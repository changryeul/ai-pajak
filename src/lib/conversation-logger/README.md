# Conversation Logger System

AI PAJAK의 대화 내용을 기록하고 관리하는 시스템입니다.

## 기능

- ✅ **세션 관리**: 대화 세션의 시작/종료 추적
- ✅ **메시지 로깅**: 사용자, AI, 시스템 메시지 기록
- ✅ **메타데이터**: 태그, 사용자 ID, 커스텀 데이터 저장
- ✅ **통계**: 대화 시간, 메시지 수 등 자동 계산
- ✅ **내보내기/가져오기**: JSON 포맷으로 세션 저장/로드
- ✅ **다중 저장소**: 메모리, 파일, 데이터베이스 지원

## 사용법

### 1. 기본 사용

```typescript
import { getConversationLogger } from '@/lib/conversation-logger';

// 로거 인스턴스 가져오기
const logger = getConversationLogger({
  storage: 'memory',
  autoSave: true
});

// 세션 시작
const sessionId = logger.startSession({
  userId: 'user-123',
  topic: 'PPh 21 세금 계산',
  tags: ['tax', 'pph21']
});

// 메시지 추가
logger.addMessage('user', '안녕하세요. PPh 21을 계산하고 싶어요.');
logger.addMessage('assistant', 'PPh 21 계산을 도와드리겠습니다. 월 급여액을 알려주세요.');
logger.addMessage('user', '월 급여는 15,000,000 루피아입니다.');

// 통계 확인
const stats = logger.getSessionStats();
console.log(stats);
// {
//   totalMessages: 3,
//   userMessages: 2,
//   assistantMessages: 1,
//   durationMs: 125000,
//   durationMinutes: 2,
//   averageMessageLength: 45
// }

// 세션 종료
const session = logger.endSession();
```

### 2. React 컴포넌트에서 사용

```typescript
'use client';

import { useEffect, useState } from 'react';
import { getConversationLogger } from '@/lib/conversation-logger';
import type { ConversationSession } from '@/lib/conversation-logger/types';

export function ChatComponent() {
  const [session, setSession] = useState<ConversationSession | null>(null);
  const logger = getConversationLogger();

  useEffect(() => {
    // 세션 시작
    logger.startSession({ topic: 'Customer Support' });
    setSession(logger.getCurrentSession());

    return () => {
      // 컴포넌트 언마운트 시 세션 종료
      logger.endSession();
    };
  }, []);

  const handleSendMessage = (content: string) => {
    logger.addMessage('user', content);
    setSession({ ...logger.getCurrentSession()! });

    // AI 응답 시뮬레이션
    setTimeout(() => {
      logger.addMessage('assistant', 'AI 응답입니다.');
      setSession({ ...logger.getCurrentSession()! });
    }, 1000);
  };

  return (
    <div>
      {session?.messages.map(msg => (
        <div key={msg.id}>
          <strong>{msg.role}:</strong> {msg.content}
        </div>
      ))}
    </div>
  );
}
```

### 3. JSON 내보내기/가져오기

```typescript
// 세션을 JSON으로 내보내기
const json = logger.exportSession();
console.log(json);

// 파일로 저장
const blob = new Blob([json], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'conversation.json';
a.click();

// JSON에서 세션 가져오기
const importedSession = logger.importSession(json);
```

## API Reference

### ConversationLogger

#### `startSession(metadata?: object): string`
새 대화 세션을 시작하고 세션 ID를 반환합니다.

#### `endSession(): ConversationSession | null`
현재 세션을 종료하고 세션 객체를 반환합니다.

#### `addMessage(role, content, metadata?): Message`
현재 세션에 메시지를 추가합니다.

#### `getCurrentSession(): ConversationSession | null`
현재 활성 세션을 반환합니다.

#### `getSessionStats(session?): object`
세션의 통계 정보를 계산합니다.

#### `exportSession(session?): string`
세션을 JSON 문자열로 내보냅니다.

#### `importSession(json: string): ConversationSession`
JSON 문자열에서 세션을 가져옵니다.

## 타입 정의

```typescript
type MessageRole = 'user' | 'assistant' | 'system';

interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  metadata?: {
    userId?: string;
    sessionId?: string;
    tags?: string[];
    [key: string]: any;
  };
}

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

interface ConversationLoggerConfig {
  storage: 'database' | 'file' | 'memory';
  autoSave?: boolean;
  maxMessagesPerSession?: number;
}
```

## 페이지

대화 기록을 확인하려면 다음 URL에 접속하세요:

- [http://localhost:3000/ko/conversation-logs](http://localhost:3000/ko/conversation-logs)

## 향후 개선 사항

- [ ] Supabase 데이터베이스 저장 구현
- [ ] 파일 시스템 저장 구현
- [ ] 대화 검색 기능
- [ ] 대화 필터링 (날짜, 태그, 사용자)
- [ ] 대화 분석 및 인사이트
- [ ] 다국어 지원 (i18n)
