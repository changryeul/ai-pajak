/**
 * Conversation Logger Tests
 * 대화 로거 유닛 테스트
 */

import { ConversationLogger } from '../logger';

describe('ConversationLogger', () => {
  let logger: ConversationLogger;

  beforeEach(() => {
    logger = new ConversationLogger({ storage: 'memory' });
  });

  describe('Session Management', () => {
    test('should start a new session', () => {
      const sessionId = logger.startSession({ topic: 'Test Topic' });
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');

      const session = logger.getCurrentSession();
      expect(session).toBeTruthy();
      expect(session?.id).toBe(sessionId);
      expect(session?.metadata?.topic).toBe('Test Topic');
    });

    test('should end a session', () => {
      logger.startSession();
      const session = logger.endSession();

      expect(session).toBeTruthy();
      expect(session?.endTime).toBeDefined();
      expect(logger.getCurrentSession()).toBeNull();
    });

    test('should return null when ending without active session', () => {
      const result = logger.endSession();
      expect(result).toBeNull();
    });
  });

  describe('Message Management', () => {
    beforeEach(() => {
      logger.startSession();
    });

    test('should add user message', () => {
      const message = logger.addMessage('user', 'Hello');

      expect(message.id).toBeDefined();
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello');
      expect(message.timestamp).toBeInstanceOf(Date);
    });

    test('should add assistant message', () => {
      const message = logger.addMessage('assistant', 'Hi there!');

      expect(message.role).toBe('assistant');
      expect(message.content).toBe('Hi there!');
    });

    test('should add message with metadata', () => {
      const message = logger.addMessage('user', 'Test', {
        tags: ['important', 'urgent'],
      });

      expect(message.metadata?.tags).toEqual(['important', 'urgent']);
    });

    test('should throw error when adding message without session', () => {
      const freshLogger = new ConversationLogger();

      expect(() => {
        freshLogger.addMessage('user', 'Test');
      }).toThrow('No active session');
    });

    test('should respect max messages limit', () => {
      const limitedLogger = new ConversationLogger({
        storage: 'memory',
        maxMessagesPerSession: 3,
      });

      limitedLogger.startSession();
      limitedLogger.addMessage('user', 'Message 1');
      limitedLogger.addMessage('user', 'Message 2');
      limitedLogger.addMessage('user', 'Message 3');
      limitedLogger.addMessage('user', 'Message 4');

      const session = limitedLogger.getCurrentSession();
      expect(session?.messages.length).toBe(3);
      expect(session?.messages[0].content).toBe('Message 2'); // First message removed
    });
  });

  describe('Session Stats', () => {
    beforeEach(() => {
      logger.startSession();
    });

    test('should calculate basic stats', () => {
      logger.addMessage('user', 'Hello');
      logger.addMessage('assistant', 'Hi');
      logger.addMessage('user', 'How are you?');

      const stats = logger.getSessionStats();

      expect(stats?.totalMessages).toBe(3);
      expect(stats?.userMessages).toBe(2);
      expect(stats?.assistantMessages).toBe(1);
      expect(stats?.durationMs).toBeGreaterThan(0);
    });

    test('should return null stats for no session', () => {
      const freshLogger = new ConversationLogger();
      const stats = freshLogger.getSessionStats();
      expect(stats).toBeNull();
    });

    test('should calculate average message length', () => {
      logger.addMessage('user', 'Hi'); // 2 chars
      logger.addMessage('assistant', 'Hello'); // 5 chars

      const stats = logger.getSessionStats();
      expect(stats?.averageMessageLength).toBe(3.5);
    });
  });

  describe('Export/Import', () => {
    beforeEach(() => {
      logger.startSession({ topic: 'Export Test' });
      logger.addMessage('user', 'Test message');
    });

    test('should export session to JSON', () => {
      const json = logger.exportSession();

      expect(json).toBeDefined();
      expect(typeof json).toBe('string');

      const parsed = JSON.parse(json);
      expect(parsed.metadata.topic).toBe('Export Test');
      expect(parsed.messages).toHaveLength(1);
    });

    test('should import session from JSON', () => {
      const json = logger.exportSession();
      const imported = logger.importSession(json);

      expect(imported.metadata?.topic).toBe('Export Test');
      expect(imported.messages).toHaveLength(1);
      expect(imported.messages[0].content).toBe('Test message');
    });

    test('should preserve dates during export/import', () => {
      const original = logger.getCurrentSession();
      const json = logger.exportSession();
      const imported = logger.importSession(json);

      expect(imported.startTime).toBeInstanceOf(Date);
      expect(imported.messages[0].timestamp).toBeInstanceOf(Date);
      expect(imported.startTime.getTime()).toBe(original!.startTime.getTime());
    });
  });
});
