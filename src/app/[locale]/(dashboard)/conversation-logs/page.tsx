'use client';

/**
 * Conversation Logs Page
 * 대화 기록을 확인하고 관리하는 페이지
 */

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ConversationViewer } from '@/components/conversation-viewer/conversation-viewer';
import { getConversationLogger } from '@/lib/conversation-logger/logger';
import type { ConversationSession } from '@/lib/conversation-logger/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ConversationLogsPage() {
  const t = useTranslations('ConversationLogs');
  const [currentSession, setCurrentSession] = useState<ConversationSession | null>(
    null
  );
  const [sessionStats, setSessionStats] = useState<any>(null);
  const logger = getConversationLogger({ storage: 'memory' });

  useEffect(() => {
    // 현재 활성 세션 가져오기
    const session = logger.getCurrentSession();
    setCurrentSession(session);

    if (session) {
      const stats = logger.getSessionStats(session);
      setSessionStats(stats);
    }
  }, []);

  const handleStartNewSession = () => {
    const sessionId = logger.startSession({
      topic: 'AI PAJAK 개발',
      tags: ['development', 'planning'],
    });
    const session = logger.getCurrentSession();
    setCurrentSession(session);
    console.log('New session started:', sessionId);
  };

  const handleAddTestMessage = (role: 'user' | 'assistant') => {
    const content =
      role === 'user'
        ? '테스트 사용자 메시지입니다.'
        : '테스트 AI 응답 메시지입니다.';

    logger.addMessage(role, content, {
      tags: ['test'],
    });

    // UI 업데이트
    const session = logger.getCurrentSession();
    setCurrentSession(session ? { ...session } : null);

    if (session) {
      const stats = logger.getSessionStats(session);
      setSessionStats(stats);
    }
  };

  const handleExportSession = () => {
    if (!currentSession) return;

    const json = logger.exportSession(currentSession);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${currentSession.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleEndSession = () => {
    const endedSession = logger.endSession();
    console.log('Session ended:', endedSession);
    setCurrentSession(null);
    setSessionStats(null);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">대화 기록</h1>
          <p className="text-gray-600 mt-1">
            AI와의 대화 내용을 확인하고 관리합니다
          </p>
        </div>
      </div>

      {/* 세션 컨트롤 */}
      <Card>
        <CardHeader>
          <CardTitle>세션 관리</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            {!currentSession ? (
              <Button onClick={handleStartNewSession}>새 세션 시작</Button>
            ) : (
              <>
                <Button onClick={handleEndSession} variant="destructive">
                  세션 종료
                </Button>
                <Button
                  onClick={() => handleAddTestMessage('user')}
                  variant="outline"
                >
                  사용자 메시지 추가 (테스트)
                </Button>
                <Button
                  onClick={() => handleAddTestMessage('assistant')}
                  variant="outline"
                >
                  AI 메시지 추가 (테스트)
                </Button>
                <Button onClick={handleExportSession} variant="outline">
                  JSON 내보내기
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 통계 정보 */}
      {sessionStats && (
        <Card>
          <CardHeader>
            <CardTitle>대화 통계</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">전체 메시지</p>
                <p className="text-2xl font-bold">{sessionStats.totalMessages}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">사용자 메시지</p>
                <p className="text-2xl font-bold">{sessionStats.userMessages}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">AI 응답</p>
                <p className="text-2xl font-bold">
                  {sessionStats.assistantMessages}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">대화 시간</p>
                <p className="text-2xl font-bold">
                  {sessionStats.durationMinutes}분
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 대화 뷰어 */}
      {currentSession ? (
        <ConversationViewer
          session={currentSession}
          onExport={handleExportSession}
        />
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">
              활성 세션이 없습니다. 새 세션을 시작하세요.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
