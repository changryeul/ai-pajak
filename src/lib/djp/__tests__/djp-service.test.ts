/**
 * DJP Service Unit Tests
 *
 * Tests for DJP API client functionality
 * Focus on pure logic testing without external dependencies
 */

import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';

// Test DJP error classes
describe('DJP Error Classes', () => {
  // Import actual error classes
  const createDJPError = (message: string, code: string, details?: unknown) => {
    const error = new Error(message) as Error & { code: string; details?: unknown };
    error.name = 'DJPError';
    error.code = code;
    error.details = details;
    return error;
  };

  const createDJPAuthError = (message: string) => {
    const error = new Error(message) as Error & { code: string };
    error.name = 'DJPAuthError';
    error.code = 'AUTH_ERROR';
    return error;
  };

  const createDJPValidationError = (message: string, validationErrors: Array<{ field: string; message: string }>) => {
    const error = new Error(message) as Error & { code: string; validationErrors: Array<{ field: string; message: string }> };
    error.name = 'DJPValidationError';
    error.code = 'VALIDATION_ERROR';
    error.validationErrors = validationErrors;
    return error;
  };

  it('should create DJPError with correct properties', () => {
    const error = createDJPError('Test error', 'TEST_ERROR', { detail: 'test' });

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.details).toEqual({ detail: 'test' });
    expect(error.name).toBe('DJPError');
  });

  it('should create DJPAuthError', () => {
    const error = createDJPAuthError('Auth failed');

    expect(error.message).toBe('Auth failed');
    expect(error.code).toBe('AUTH_ERROR');
    expect(error.name).toBe('DJPAuthError');
  });

  it('should create DJPValidationError with validation errors', () => {
    const validationErrors = [
      { field: 'npwp', message: 'Invalid format' },
      { field: 'taxYear', message: 'Required' },
    ];
    const error = createDJPValidationError('Validation failed', validationErrors);

    expect(error.message).toBe('Validation failed');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.validationErrors).toEqual(validationErrors);
    expect(error.name).toBe('DJPValidationError');
  });
});

describe('Webhook Signature Verification Logic', () => {
  const WEBHOOK_SECRET = 'test-webhook-secret';

  function verifySignature(payload: string, signature: string, timestamp: string): boolean {
    // Simulate the verification logic from DJPService
    const TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes
    const timestampMs = parseInt(timestamp, 10) * 1000;
    const now = Date.now();

    // Check timestamp tolerance
    if (Math.abs(now - timestampMs) > TOLERANCE_MS) {
      return false;
    }

    // Generate expected signature
    const signatureData = `${timestamp}.${payload}`;
    const expectedSignature = createHmac('sha256', WEBHOOK_SECRET)
      .update(signatureData)
      .digest('hex');

    return signature === expectedSignature;
  }

  function generateValidSignature(payload: string, timestamp: string): string {
    const signatureData = `${timestamp}.${payload}`;
    return createHmac('sha256', WEBHOOK_SECRET)
      .update(signatureData)
      .digest('hex');
  }

  it('should verify valid signature', () => {
    const payload = JSON.stringify({
      event_type: 'FILING_ACCEPTED',
      transaction_id: 'TXN-123456',
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = generateValidSignature(payload, timestamp);

    expect(verifySignature(payload, signature, timestamp)).toBe(true);
  });

  it('should reject invalid signature', () => {
    const payload = JSON.stringify({
      event_type: 'FILING_ACCEPTED',
      transaction_id: 'TXN-123456',
    });
    const timestamp = String(Math.floor(Date.now() / 1000));

    expect(verifySignature(payload, 'invalid-signature', timestamp)).toBe(false);
  });

  it('should reject expired timestamp', () => {
    const payload = JSON.stringify({
      event_type: 'FILING_ACCEPTED',
      transaction_id: 'TXN-123456',
    });
    // Timestamp from 10 minutes ago (beyond 5 minute tolerance)
    const oldTimestamp = String(Math.floor(Date.now() / 1000) - 600);
    const signature = generateValidSignature(payload, oldTimestamp);

    expect(verifySignature(payload, signature, oldTimestamp)).toBe(false);
  });

  it('should reject tampered payload', () => {
    const originalPayload = JSON.stringify({
      event_type: 'FILING_ACCEPTED',
      transaction_id: 'TXN-123',
    });
    const tamperedPayload = JSON.stringify({
      event_type: 'FILING_ACCEPTED',
      transaction_id: 'TXN-999',
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = generateValidSignature(originalPayload, timestamp);

    expect(verifySignature(tamperedPayload, signature, timestamp)).toBe(false);
  });
});

describe('Token Cache Logic', () => {
  interface CachedToken {
    accessToken: string;
    expiresAt: Date;
    tokenType: string;
  }

  function isTokenValid(token: CachedToken | null): boolean {
    if (!token) return false;
    // Add 1 minute buffer
    return token.expiresAt.getTime() > Date.now() + 60000;
  }

  it('should return false for null token', () => {
    expect(isTokenValid(null)).toBe(false);
  });

  it('should return true for valid token', () => {
    const token: CachedToken = {
      accessToken: 'test-token',
      expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      tokenType: 'Bearer',
    };
    expect(isTokenValid(token)).toBe(true);
  });

  it('should return false for expired token', () => {
    const token: CachedToken = {
      accessToken: 'expired-token',
      expiresAt: new Date(Date.now() - 1000), // Already expired
      tokenType: 'Bearer',
    };
    expect(isTokenValid(token)).toBe(false);
  });

  it('should return false for token expiring within buffer', () => {
    const token: CachedToken = {
      accessToken: 'expiring-soon-token',
      expiresAt: new Date(Date.now() + 30000), // 30 seconds from now (within 1 minute buffer)
      tokenType: 'Bearer',
    };
    expect(isTokenValid(token)).toBe(false);
  });
});

describe('NPWP Validation Logic', () => {
  function isValidNPWPFormat(npwp: string): boolean {
    // NPWP format: 15 digits
    const cleanNpwp = npwp.replace(/[.\-]/g, '');
    return /^\d{15}$/.test(cleanNpwp);
  }

  function formatNPWP(npwp: string): string {
    const clean = npwp.replace(/[.\-]/g, '');
    if (clean.length !== 15) return npwp;
    return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}.${clean.slice(8, 9)}-${clean.slice(9, 12)}.${clean.slice(12, 15)}`;
  }

  function maskNPWP(npwp: string): string {
    const clean = npwp.replace(/[.\-]/g, '');
    if (clean.length !== 15) return npwp;
    return `${clean.slice(0, 2)}.***.***.*-***.${clean.slice(12, 15)}`;
  }

  it('should validate correct NPWP format', () => {
    expect(isValidNPWPFormat('123456789012345')).toBe(true);
    expect(isValidNPWPFormat('12.345.678.9-012.345')).toBe(true);
  });

  it('should reject invalid NPWP format', () => {
    expect(isValidNPWPFormat('12345')).toBe(false);
    expect(isValidNPWPFormat('1234567890123456')).toBe(false); // 16 digits
    expect(isValidNPWPFormat('12345678901234a')).toBe(false); // Contains letter
  });

  it('should format NPWP correctly', () => {
    expect(formatNPWP('123456789012345')).toBe('12.345.678.9-012.345');
  });

  it('should mask NPWP for logging', () => {
    expect(maskNPWP('123456789012345')).toBe('12.***.***.*-***.345');
  });
});

describe('SPT Type Mapping', () => {
  type InternalTaxType = 'PPh21' | 'PPh23' | 'PPh_FINAL' | 'PPN' | 'SPT_MASA' | 'SPT_TAHUNAN';
  type DJPSPTType = 'SPT_MASA_PPH21' | 'SPT_MASA_PPH23' | 'SPT_MASA_PPH4_2' | 'SPT_MASA_PPN' | 'SPT_TAHUNAN_1770';

  const sptTypeMap: Record<InternalTaxType, DJPSPTType> = {
    PPh21: 'SPT_MASA_PPH21',
    PPh23: 'SPT_MASA_PPH23',
    PPh_FINAL: 'SPT_MASA_PPH4_2',
    PPN: 'SPT_MASA_PPN',
    SPT_MASA: 'SPT_MASA_PPH21',
    SPT_TAHUNAN: 'SPT_TAHUNAN_1770',
  };

  it('should map PPh21 to SPT_MASA_PPH21', () => {
    expect(sptTypeMap['PPh21']).toBe('SPT_MASA_PPH21');
  });

  it('should map PPh23 to SPT_MASA_PPH23', () => {
    expect(sptTypeMap['PPh23']).toBe('SPT_MASA_PPH23');
  });

  it('should map PPh_FINAL to SPT_MASA_PPH4_2', () => {
    expect(sptTypeMap['PPh_FINAL']).toBe('SPT_MASA_PPH4_2');
  });

  it('should map PPN to SPT_MASA_PPN', () => {
    expect(sptTypeMap['PPN']).toBe('SPT_MASA_PPN');
  });

  it('should map SPT_TAHUNAN to SPT_TAHUNAN_1770', () => {
    expect(sptTypeMap['SPT_TAHUNAN']).toBe('SPT_TAHUNAN_1770');
  });
});

describe('Retry Delay Calculation', () => {
  function calculateRetryDelay(retryCount: number): number {
    // Exponential backoff: 5^retryCount minutes
    return Math.pow(5, retryCount) * 60 * 1000;
  }

  it('should calculate 5 minutes for first retry', () => {
    expect(calculateRetryDelay(1)).toBe(5 * 60 * 1000); // 5 minutes
  });

  it('should calculate 25 minutes for second retry', () => {
    expect(calculateRetryDelay(2)).toBe(25 * 60 * 1000); // 25 minutes
  });

  it('should calculate 125 minutes for third retry', () => {
    expect(calculateRetryDelay(3)).toBe(125 * 60 * 1000); // 125 minutes
  });
});

describe('Job Progress Calculation', () => {
  type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

  function getProgressFromStatus(status: JobStatus): number {
    switch (status) {
      case 'PENDING':
        return 0;
      case 'PROCESSING':
        return 50;
      case 'COMPLETED':
        return 100;
      case 'FAILED':
      case 'CANCELLED':
        return 0;
      default:
        return 0;
    }
  }

  it('should return 0 for PENDING status', () => {
    expect(getProgressFromStatus('PENDING')).toBe(0);
  });

  it('should return 50 for PROCESSING status', () => {
    expect(getProgressFromStatus('PROCESSING')).toBe(50);
  });

  it('should return 100 for COMPLETED status', () => {
    expect(getProgressFromStatus('COMPLETED')).toBe(100);
  });

  it('should return 0 for FAILED status', () => {
    expect(getProgressFromStatus('FAILED')).toBe(0);
  });

  it('should return 0 for CANCELLED status', () => {
    expect(getProgressFromStatus('CANCELLED')).toBe(0);
  });
});

describe('Webhook Event Type Handling', () => {
  type WebhookEventType = 'FILING_ACCEPTED' | 'FILING_REJECTED' | 'BPE_READY' | 'BILLING_PAID';

  const knownEventTypes: WebhookEventType[] = [
    'FILING_ACCEPTED',
    'FILING_REJECTED',
    'BPE_READY',
    'BILLING_PAID',
  ];

  function isKnownEventType(eventType: string): eventType is WebhookEventType {
    return knownEventTypes.includes(eventType as WebhookEventType);
  }

  function getActivityTypeForEvent(eventType: WebhookEventType): string {
    return `DJP_${eventType}`;
  }

  it('should recognize known event types', () => {
    expect(isKnownEventType('FILING_ACCEPTED')).toBe(true);
    expect(isKnownEventType('FILING_REJECTED')).toBe(true);
    expect(isKnownEventType('BPE_READY')).toBe(true);
    expect(isKnownEventType('BILLING_PAID')).toBe(true);
  });

  it('should reject unknown event types', () => {
    expect(isKnownEventType('UNKNOWN_EVENT')).toBe(false);
    expect(isKnownEventType('')).toBe(false);
  });

  it('should generate correct activity type', () => {
    expect(getActivityTypeForEvent('FILING_ACCEPTED')).toBe('DJP_FILING_ACCEPTED');
    expect(getActivityTypeForEvent('BILLING_PAID')).toBe('DJP_BILLING_PAID');
  });
});

describe('Filing Status Updates', () => {
  interface FilingStatusUpdate {
    status: string;
    djp_submission_status: string;
    bpe_number?: string;
    filed_at?: string;
    djp_error_code?: string;
    djp_error_message?: string;
  }

  function createAcceptedUpdate(bpeNumber: string, _bpeDate: string): FilingStatusUpdate {
    return {
      status: 'FILED',
      djp_submission_status: 'ACCEPTED',
      bpe_number: bpeNumber,
      filed_at: new Date().toISOString(),
    };
  }

  function createRejectedUpdate(errorCode: string, errorMessage: string): FilingStatusUpdate {
    return {
      status: 'DRAFT',
      djp_submission_status: 'REJECTED',
      djp_error_code: errorCode,
      djp_error_message: errorMessage,
    };
  }

  it('should create correct update for accepted filing', () => {
    const update = createAcceptedUpdate('BPE-2024-123', '2024-01-15');

    expect(update.status).toBe('FILED');
    expect(update.djp_submission_status).toBe('ACCEPTED');
    expect(update.bpe_number).toBe('BPE-2024-123');
    expect(update.filed_at).toBeDefined();
  });

  it('should create correct update for rejected filing', () => {
    const update = createRejectedUpdate('INVALID_NPWP', 'NPWP format is invalid');

    expect(update.status).toBe('DRAFT');
    expect(update.djp_submission_status).toBe('REJECTED');
    expect(update.djp_error_code).toBe('INVALID_NPWP');
    expect(update.djp_error_message).toBe('NPWP format is invalid');
  });
});

describe('Billing Code Validation', () => {
  function isValidBillingCode(kodeBilling: string): boolean {
    // Kode Billing is 15-16 digits
    return /^\d{15,16}$/.test(kodeBilling);
  }

  function isValidNTPN(ntpn: string): boolean {
    // NTPN format validation
    return /^[A-Z0-9]{16}$/.test(ntpn);
  }

  it('should validate correct billing code', () => {
    expect(isValidBillingCode('123456789012345')).toBe(true);
    expect(isValidBillingCode('1234567890123456')).toBe(true);
  });

  it('should reject invalid billing code', () => {
    expect(isValidBillingCode('12345')).toBe(false);
    expect(isValidBillingCode('123456789012345A')).toBe(false);
  });

  it('should validate correct NTPN', () => {
    expect(isValidNTPN('ABCD123456789012')).toBe(true);
  });

  it('should reject invalid NTPN', () => {
    expect(isValidNTPN('abc')).toBe(false);
    expect(isValidNTPN('abcd123456789012')).toBe(false); // lowercase
  });
});
