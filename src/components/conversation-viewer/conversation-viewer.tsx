'use client';

/**
 * Conversation Viewer Component
 * 대화 내용을 시각화하는 UI 컴포넌트
 */

import { useState } from 'react';
import type { ConversationSession, Message } from '@/lib/conversation-logger/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ConversationViewerProps {
  session: ConversationSession;
  onExport?: () => void;
}

export function ConversationViewer({
  session,
  onExport,
}: ConversationViewerProps) {
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(
    new Set()
  );

  const toggleMessage = (messageId: string) => {
    const newExpanded = new Set(expandedMessages);
    if (newExpanded.has(messageId)) {
      newExpanded.delete(messageId);
    } else {
      newExpanded.add(messageId);
    }
    setExpandedMessages(newExpanded);
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  const formatDuration = () => {
    const start = session.startTime;
    const end = session.endTime || new Date();
    const durationMs = end.getTime() - start.getTime();
    const minutes = Math.floor(durationMs / 1000 / 60);
    const seconds = Math.floor((durationMs / 1000) % 60);
    return `${minutes}분 ${seconds}초`;
  };

  const getRoleColor = (role: Message['role']) => {
    switch (role) {
      case 'user':
        return 'bg-blue-50 border-blue-200';
      case 'assistant':
        return 'bg-green-50 border-green-200';
      case 'system':
        return 'bg-gray-50 border-gray-200';
      default:
        return 'bg-white border-gray-200';
    }
  };

  const getRoleLabel = (role: Message['role']) => {
    switch (role) {
      case 'user':
        return '사용자';
      case 'assistant':
        return 'AI 어시스턴트';
      case 'system':
        return '시스템';
      default:
        return role;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* 세션 정보 헤더 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>대화 기록</CardTitle>
            {onExport && (
              <Button onClick={onExport} variant="outline" size="sm">
                JSON 내보내기
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">세션 ID:</span>{' '}
              <span className="text-gray-600">{session.id}</span>
            </div>
            <div>
              <span className="font-medium">대화 시간:</span>{' '}
              <span className="text-gray-600">{formatDuration()}</span>
            </div>
            <div>
              <span className="font-medium">시작 시각:</span>{' '}
              <span className="text-gray-600">
                {new Intl.DateTimeFormat('ko-KR', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(session.startTime)}
              </span>
            </div>
            <div>
              <span className="font-medium">메시지 수:</span>{' '}
              <span className="text-gray-600">{session.messages.length}개</span>
            </div>
            {session.metadata?.topic && (
              <div className="col-span-2">
                <span className="font-medium">주제:</span>{' '}
                <span className="text-gray-600">{session.metadata.topic}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 메시지 목록 */}
      <div className="space-y-3">
        {session.messages.map((message) => {
          const isExpanded = expandedMessages.has(message.id);
          const shouldTruncate = message.content.length > 500;

          return (
            <Card
              key={message.id}
              className={`${getRoleColor(message.role)} border-2`}
            >
              <CardContent className="pt-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">
                      {getRoleLabel(message.role)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatTime(message.timestamp)}
                    </span>
                  </div>
                  {message.metadata?.tags && (
                    <div className="flex gap-1">
                      {message.metadata.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-white rounded text-xs text-gray-600"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="text-sm whitespace-pre-wrap">
                  {shouldTruncate && !isExpanded
                    ? message.content.substring(0, 500) + '...'
                    : message.content}
                </div>

                {shouldTruncate && (
                  <button
                    onClick={() => toggleMessage(message.id)}
                    className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {isExpanded ? '접기' : '더 보기'}
                  </button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {session.messages.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            아직 메시지가 없습니다.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
