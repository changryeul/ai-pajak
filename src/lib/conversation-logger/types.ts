/**
 * Conversation Logger Types
 * 대화 로깅 시스템 타입 정의
 */

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
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

export interface ConversationSession {
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

export interface ConversationFilter {
  userId?: string;
  sessionId?: string;
  startDate?: Date;
  endDate?: Date;
  tags?: string[];
  role?: MessageRole;
}

export interface ConversationLoggerConfig {
  storage: 'database' | 'file' | 'memory';
  autoSave?: boolean;
  maxMessagesPerSession?: number;
}
