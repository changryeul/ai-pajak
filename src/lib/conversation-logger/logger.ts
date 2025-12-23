/**
 * Conversation Logger
 * 대화 내용을 기록하고 관리하는 핵심 유틸리티
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Message,
  ConversationSession,
  MessageRole,
  ConversationLoggerConfig,
} from './types';

export class ConversationLogger {
  private currentSession: ConversationSession | null = null;
  private config: ConversationLoggerConfig;

  constructor(config: ConversationLoggerConfig = { storage: 'memory' }) {
    this.config = config;
  }

  /**
   * 새로운 대화 세션 시작
   */
  startSession(metadata?: ConversationSession['metadata']): string {
    const sessionId = uuidv4();
    this.currentSession = {
      id: sessionId,
      startTime: new Date(),
      messages: [],
      metadata,
    };
    return sessionId;
  }

  /**
   * 현재 세션 종료
   */
  endSession(): ConversationSession | null {
    if (!this.currentSession) {
      return null;
    }

    this.currentSession.endTime = new Date();
    const session = this.currentSession;
    this.currentSession = null;

    if (this.config.autoSave) {
      this.saveSession(session);
    }

    return session;
  }

  /**
   * 메시지 추가
   */
  addMessage(
    role: MessageRole,
    content: string,
    metadata?: Message['metadata']
  ): Message {
    if (!this.currentSession) {
      throw new Error('No active session. Call startSession() first.');
    }

    const message: Message = {
      id: uuidv4(),
      role,
      content,
      timestamp: new Date(),
      metadata: {
        ...metadata,
        sessionId: this.currentSession.id,
      },
    };

    this.currentSession.messages.push(message);

    // 최대 메시지 수 체크
    if (
      this.config.maxMessagesPerSession &&
      this.currentSession.messages.length > this.config.maxMessagesPerSession
    ) {
      // 오래된 메시지 제거
      this.currentSession.messages.shift();
    }

    return message;
  }

  /**
   * 현재 세션 정보 가져오기
   */
  getCurrentSession(): ConversationSession | null {
    return this.currentSession;
  }

  /**
   * 세션을 저장소에 저장
   */
  private async saveSession(session: ConversationSession): Promise<void> {
    switch (this.config.storage) {
      case 'database':
        await this.saveToDB(session);
        break;
      case 'file':
        await this.saveToFile(session);
        break;
      case 'memory':
        // Memory storage는 별도 저장 불필요
        break;
    }
  }

  /**
   * 데이터베이스에 저장 (Supabase)
   */
  private async saveToDB(session: ConversationSession): Promise<void> {
    // TODO: Supabase 클라이언트 연동
    console.log('Saving to database:', session.id);
  }

  /**
   * 파일로 저장 (로컬 개발용)
   */
  private async saveToFile(session: ConversationSession): Promise<void> {
    // TODO: 파일 시스템 저장 구현
    console.log('Saving to file:', session.id);
  }

  /**
   * 세션을 JSON으로 내보내기
   */
  exportSession(session?: ConversationSession): string {
    const targetSession = session || this.currentSession;
    if (!targetSession) {
      throw new Error('No session to export');
    }

    return JSON.stringify(
      {
        ...targetSession,
        startTime: targetSession.startTime.toISOString(),
        endTime: targetSession.endTime?.toISOString(),
        messages: targetSession.messages.map((msg) => ({
          ...msg,
          timestamp: msg.timestamp.toISOString(),
        })),
      },
      null,
      2
    );
  }

  /**
   * JSON에서 세션 가져오기
   */
  importSession(json: string): ConversationSession {
    const data = JSON.parse(json);
    return {
      ...data,
      startTime: new Date(data.startTime),
      endTime: data.endTime ? new Date(data.endTime) : undefined,
      messages: data.messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      })),
    };
  }

  /**
   * 대화 통계 계산
   */
  getSessionStats(session?: ConversationSession) {
    const targetSession = session || this.currentSession;
    if (!targetSession) {
      return null;
    }

    const userMessages = targetSession.messages.filter(
      (msg) => msg.role === 'user'
    );
    const assistantMessages = targetSession.messages.filter(
      (msg) => msg.role === 'assistant'
    );

    const duration =
      targetSession.endTime && targetSession.startTime
        ? targetSession.endTime.getTime() - targetSession.startTime.getTime()
        : Date.now() - targetSession.startTime.getTime();

    return {
      totalMessages: targetSession.messages.length,
      userMessages: userMessages.length,
      assistantMessages: assistantMessages.length,
      durationMs: duration,
      durationMinutes: Math.round(duration / 1000 / 60),
      averageMessageLength:
        targetSession.messages.reduce((sum, msg) => sum + msg.content.length, 0) /
        targetSession.messages.length,
    };
  }
}

// 싱글톤 인스턴스
let globalLogger: ConversationLogger | null = null;

export function getConversationLogger(
  config?: ConversationLoggerConfig
): ConversationLogger {
  if (!globalLogger) {
    globalLogger = new ConversationLogger(config);
  }
  return globalLogger;
}
