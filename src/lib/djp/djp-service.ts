/**
 * DJP (Direktorat Jenderal Pajak) API Service
 *
 * Main API client for Indonesia Tax Authority integration
 * Handles e-Filing, e-Billing, NPWP validation, and BPE retrieval
 *
 * Pattern: Static methods like MidtransService
 *
 * Resilience Features:
 * - Circuit Breaker: Prevents cascading failures when DJP is down
 * - Timeout: 30s timeout for all API calls
 * - Retry: Automatic retry with exponential backoff
 * - Structured Logging: JSON logs with request context
 */

import crypto from 'crypto';
import { DJP_API } from '@/config/constants';
import { circuitBreakers } from '@/lib/resilience/circuit-breaker';
import { fetchWithTimeoutAndRetry } from '@/lib/resilience/timeout';
import { loggers } from '@/lib/logger';
import {
  DJPAuthToken,
  DJPSubmissionStatus,
  EFilingRequest,
  EFilingResponse,
  EBillingRequest,
  EBillingResponse,
  NPWPValidationRequest,
  NPWPValidationResponse,
  BPERetrievalRequest,
  BPERetrievalResponse,
  SPTType,
} from './types';

// Lazy initialization for auth token caching
let cachedAuthToken: DJPAuthToken | null = null;

/**
 * DJP Service - Indonesia Tax Authority API Client
 */
export class DJPService {
  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  private static get isProduction(): boolean {
    return process.env.NODE_ENV === 'production' && !DJP_API.USE_SANDBOX;
  }

  private static get baseUrl(): string {
    return this.isProduction
      ? DJP_API.BASE_URL
      : DJP_API.SANDBOX_URL;
  }

  private static get clientId(): string {
    return process.env.DJP_CLIENT_ID || '';
  }

  private static get clientSecret(): string {
    return process.env.DJP_CLIENT_SECRET || '';
  }

  private static get webhookSecret(): string {
    return process.env.DJP_WEBHOOK_SECRET || '';
  }

  private static get isEnabled(): boolean {
    return process.env.DJP_ENABLED === 'true';
  }

  // ============================================================================
  // AUTHENTICATION
  // ============================================================================

  /**
   * Get valid auth token, refreshing if necessary
   */
  static async getAuthToken(): Promise<DJPAuthToken> {
    // Check if DJP is enabled
    if (!this.isEnabled) {
      throw new DJPError('DJP integration is not enabled', 'DJP_DISABLED');
    }

    // Check cached token validity (with 60 second buffer)
    if (cachedAuthToken && cachedAuthToken.expiresAt > new Date(Date.now() + 60000)) {
      return cachedAuthToken;
    }

    // Validate credentials
    if (!this.clientId || !this.clientSecret) {
      throw new DJPAuthError('DJP credentials not configured', 'MISSING_CREDENTIALS');
    }

    loggers.djp.info('Requesting new auth token');

    try {
      // Use circuit breaker and timeout for auth requests
      const response = await circuitBreakers.djp.execute(() =>
        fetchWithTimeoutAndRetry(`${this.baseUrl}${DJP_API.ENDPOINTS.AUTH}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: this.clientId,
            client_secret: this.clientSecret,
            scope: 'efiling ebilling npwp',
          }),
          timeout: 15000, // 15s timeout for auth
          maxRetries: 2,
        })
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        loggers.djp.error({ errorCode: error.error }, 'Auth failed');
        throw new DJPAuthError(
          error.error_description || 'Failed to authenticate with DJP',
          error.error || 'AUTH_FAILED'
        );
      }

      const data = await response.json();

      cachedAuthToken = {
        accessToken: data.access_token,
        tokenType: data.token_type || 'Bearer',
        expiresIn: data.expires_in,
        expiresAt: new Date(Date.now() + (data.expires_in - 60) * 1000),
        scope: data.scope || '',
      };

      loggers.djp.info('Auth token obtained successfully');
      return cachedAuthToken;
    } catch (error) {
      if (error instanceof DJPError) throw error;
      loggers.djp.error({ error }, 'Network error during authentication');
      throw new DJPAuthError(
        `Network error during authentication: ${error instanceof Error ? error.message : 'Unknown'}`,
        'NETWORK_ERROR'
      );
    }
  }

  /**
   * Clear cached auth token (useful for testing or forced refresh)
   */
  static clearAuthToken(): void {
    cachedAuthToken = null;
  }

  // ============================================================================
  // E-FILING
  // ============================================================================

  /**
   * Submit tax filing to DJP e-Filing system
   */
  static async submitFiling(request: EFilingRequest): Promise<EFilingResponse> {
    const token = await this.getAuthToken();
    const requestId = crypto.randomUUID();

    loggers.djp.info({
      requestId,
      npwp: this.maskNPWP(request.npwp),
      sptType: request.sptType,
      taxPeriod: request.taxPeriod,
      taxYear: request.taxYear,
    }, 'Submitting e-Filing');

    try {
      // Use circuit breaker and timeout for filing submission
      const response = await circuitBreakers.djp.execute(() =>
        fetchWithTimeoutAndRetry(
          `${this.baseUrl}${DJP_API.ENDPOINTS.E_FILING.SUBMIT}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `${token.tokenType} ${token.accessToken}`,
              'X-Request-ID': requestId,
              'X-Timestamp': new Date().toISOString(),
            },
            body: JSON.stringify(this.transformToEFilingPayload(request)),
            timeout: 30000, // 30s timeout
            maxRetries: 2,
          }
        )
      );

      const data = await response.json();

      if (!response.ok) {
        loggers.djp.error({
          requestId,
          status: response.status,
          errorCode: data.error_code,
        }, 'e-Filing submission failed');

        return {
          success: false,
          transactionId: data.transaction_id || '',
          submissionTime: new Date(),
          status: 'FAILED',
          errorCode: data.error_code,
          errorMessage: data.error_message || data.message,
          validationErrors: data.validation_errors,
        };
      }

      loggers.djp.info({
        requestId,
        transactionId: data.transaction_id,
        status: data.status,
      }, 'e-Filing submitted successfully');

      return {
        success: true,
        transactionId: data.transaction_id,
        submissionTime: new Date(data.submission_time || Date.now()),
        status: this.mapDJPStatus(data.status),
        bpeNumber: data.bpe_number,
        bpeDate: data.bpe_date ? new Date(data.bpe_date) : undefined,
      };
    } catch (error) {
      loggers.djp.error({ requestId, error }, 'e-Filing network error');
      throw new DJPError(
        `Network error during e-Filing: ${error instanceof Error ? error.message : 'Unknown'}`,
        'NETWORK_ERROR',
        { retryable: true }
      );
    }
  }

  /**
   * Check filing status
   */
  static async checkFilingStatus(transactionId: string): Promise<EFilingResponse> {
    const token = await this.getAuthToken();

    loggers.djp.info({ transactionId }, 'Checking filing status');

    try {
      const response = await circuitBreakers.djp.execute(() =>
        fetchWithTimeoutAndRetry(
          `${this.baseUrl}${DJP_API.ENDPOINTS.E_FILING.STATUS}/${transactionId}`,
          {
            headers: {
              Authorization: `${token.tokenType} ${token.accessToken}`,
            },
            timeout: 15000,
            maxRetries: 2,
          }
        )
      );

      const data = await response.json();

      loggers.djp.info({ transactionId, status: data.status }, 'Filing status retrieved');

      return {
        success: response.ok,
        transactionId,
        submissionTime: new Date(data.submission_time || Date.now()),
        status: this.mapDJPStatus(data.status),
        bpeNumber: data.bpe_number,
        bpeDate: data.bpe_date ? new Date(data.bpe_date) : undefined,
        errorCode: data.error_code,
        errorMessage: data.error_message,
      };
    } catch (error) {
      loggers.djp.error({ transactionId, error }, 'Error checking filing status');
      throw new DJPError(
        `Network error checking status: ${error instanceof Error ? error.message : 'Unknown'}`,
        'NETWORK_ERROR',
        { retryable: true }
      );
    }
  }

  // ============================================================================
  // E-BILLING
  // ============================================================================

  /**
   * Generate billing code (Kode Billing) for tax payment
   */
  static async generateBilling(request: EBillingRequest): Promise<EBillingResponse> {
    const token = await this.getAuthToken();
    const requestId = crypto.randomUUID();

    loggers.djp.info({
      requestId,
      npwp: this.maskNPWP(request.npwp),
      jenisPajak: request.jenisPajak,
      jumlahSetor: request.jumlahSetor,
    }, 'Generating e-Billing');

    try {
      const response = await circuitBreakers.djp.execute(() =>
        fetchWithTimeoutAndRetry(
          `${this.baseUrl}${DJP_API.ENDPOINTS.E_BILLING.CREATE}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `${token.tokenType} ${token.accessToken}`,
              'X-Request-ID': requestId,
            },
            body: JSON.stringify({
              npwp: request.npwp,
              jenis_pajak: request.jenisPajak,
              jenis_setoran: request.jenisSetoran,
              masa_pajak: request.masaPajak,
              tahun_pajak: request.tahunPajak,
              jumlah_setor: request.jumlahSetor,
              uraian: request.uraian,
            }),
            timeout: 30000,
            maxRetries: 2,
          }
        )
      );

      const data = await response.json();

      if (!response.ok) {
        loggers.djp.error({ requestId, errorCode: data.error_code }, 'e-Billing generation failed');
      } else {
        loggers.djp.info({ requestId, kodeBilling: data.kode_billing }, 'e-Billing generated');
      }

      return {
        success: response.ok,
        kodeBilling: data.kode_billing,
        validUntil: data.valid_until ? new Date(data.valid_until) : undefined,
        jumlahSetor: request.jumlahSetor,
        errorCode: data.error_code,
        errorMessage: data.error_message,
      };
    } catch (error) {
      loggers.djp.error({ requestId, error }, 'Network error during e-Billing');
      throw new DJPError(
        `Network error during e-Billing: ${error instanceof Error ? error.message : 'Unknown'}`,
        'NETWORK_ERROR',
        { retryable: true }
      );
    }
  }

  // ============================================================================
  // NPWP VALIDATION
  // ============================================================================

  /**
   * Validate NPWP with DJP
   */
  static async validateNPWP(
    request: NPWPValidationRequest
  ): Promise<NPWPValidationResponse> {
    const token = await this.getAuthToken();

    loggers.djp.info({ npwp: this.maskNPWP(request.npwp) }, 'Validating NPWP');

    try {
      const response = await circuitBreakers.djp.execute(() =>
        fetchWithTimeoutAndRetry(
          `${this.baseUrl}${DJP_API.ENDPOINTS.NPWP.VALIDATE}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `${token.tokenType} ${token.accessToken}`,
            },
            body: JSON.stringify({
              npwp: request.npwp,
              nik: request.nik,
            }),
            timeout: 15000,
            maxRetries: 2,
          }
        )
      );

      const data = await response.json();

      const result: NPWPValidationResponse = {
        valid: data.valid === true,
        npwp: request.npwp,
        nama: data.nama,
        alamat: data.alamat,
        kppAdmin: data.kpp_admin,
        statusWP: data.status_wp,
        tanggalTerdaftar: data.tanggal_terdaftar
          ? new Date(data.tanggal_terdaftar)
          : undefined,
        errorCode: data.error_code,
        errorMessage: data.error_message,
      };

      loggers.djp.info({ valid: result.valid, statusWP: result.statusWP }, 'NPWP validation result');

      return result;
    } catch (error) {
      loggers.djp.error({ error }, 'Network error during NPWP validation');
      throw new DJPError(
        `Network error during NPWP validation: ${error instanceof Error ? error.message : 'Unknown'}`,
        'NETWORK_ERROR',
        { retryable: true }
      );
    }
  }

  // ============================================================================
  // BPE RETRIEVAL
  // ============================================================================

  /**
   * Retrieve BPE document from DJP
   */
  static async retrieveBPE(
    request: BPERetrievalRequest
  ): Promise<BPERetrievalResponse> {
    const token = await this.getAuthToken();

    loggers.djp.info({ transactionId: request.transactionId }, 'Retrieving BPE');

    try {
      const response = await circuitBreakers.djp.execute(() =>
        fetchWithTimeoutAndRetry(
          `${this.baseUrl}${DJP_API.ENDPOINTS.E_FILING.BPE}/${request.transactionId}`,
          {
            headers: {
              Authorization: `${token.tokenType} ${token.accessToken}`,
            },
            timeout: 30000, // BPE can include PDF, allow longer timeout
            maxRetries: 2,
          }
        )
      );

      const data = await response.json();

      loggers.djp.info({
        transactionId: request.transactionId,
        bpeNumber: data.bpe_number,
        success: response.ok,
      }, 'BPE retrieval completed');

      return {
        success: response.ok,
        bpeNumber: data.bpe_number,
        bpeDate: data.bpe_date ? new Date(data.bpe_date) : undefined,
        status: this.mapDJPStatus(data.status),
        sptType: data.spt_type,
        taxPeriod: data.tax_period,
        pdfBase64: data.pdf_base64,
        errorCode: data.error_code,
        errorMessage: data.error_message,
      };
    } catch (error) {
      loggers.djp.error({ transactionId: request.transactionId, error }, 'Error during BPE retrieval');
      throw new DJPError(
        `Network error during BPE retrieval: ${error instanceof Error ? error.message : 'Unknown'}`,
        'NETWORK_ERROR',
        { retryable: true }
      );
    }
  }

  // ============================================================================
  // WEBHOOK VERIFICATION
  // ============================================================================

  /**
   * Verify DJP webhook signature
   */
  static verifyWebhookSignature(
    payload: string,
    signature: string,
    timestamp: string
  ): boolean {
    if (!this.webhookSecret) {
      loggers.djp.error('Webhook secret not configured');
      return false;
    }

    const signatureInput = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(signatureInput)
      .digest('hex');

    try {
      const isValid = crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );

      if (!isValid) {
        loggers.djp.warn('Webhook signature verification failed');
      }

      return isValid;
    } catch {
      loggers.djp.error('Error verifying webhook signature');
      return false;
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Mask NPWP for logging (privacy)
   */
  static maskNPWP(npwp: string): string {
    const cleaned = npwp.replace(/[^0-9]/g, '');
    if (cleaned.length < 10) return '***';
    return `${cleaned.slice(0, 4)}****${cleaned.slice(-4)}`;
  }

  /**
   * Map DJP status string to our enum
   */
  private static mapDJPStatus(status: string): DJPSubmissionStatus {
    const statusMap: Record<string, DJPSubmissionStatus> = {
      PENDING: 'PENDING',
      PROCESSING: 'PROCESSING',
      ACCEPTED: 'ACCEPTED',
      REJECTED: 'REJECTED',
      FAILED: 'FAILED',
      CANCELLED: 'CANCELLED',
      // Indonesian status mappings
      DITERIMA: 'ACCEPTED',
      DITOLAK: 'REJECTED',
      DIPROSES: 'PROCESSING',
      MENUNGGU: 'PENDING',
    };
    return statusMap[status?.toUpperCase()] || 'PENDING';
  }

  /**
   * Transform internal request format to DJP API format
   */
  private static transformToEFilingPayload(
    request: EFilingRequest
  ): Record<string, unknown> {
    return {
      npwp: request.npwp,
      tahun_pajak: request.taxYear,
      masa_pajak: request.taxPeriod,
      jenis_spt: request.sptType,
      pembetulan_ke: request.correctionNumber,
      data_spt: {
        identitas_wp: {
          npwp: request.sptData.identitasWP.npwp,
          nama: request.sptData.identitasWP.nama,
          alamat: request.sptData.identitasWP.alamat,
          kota: request.sptData.identitasWP.kota,
          kode_pos: request.sptData.identitasWP.kodePos,
          telepon: request.sptData.identitasWP.telepon,
          email: request.sptData.identitasWP.email,
          status_wp: request.sptData.identitasWP.statusWP,
        },
        periode: {
          tahun_pajak: request.sptData.periodeData.tahunPajak,
          masa_pajak: request.sptData.periodeData.masaPajak,
          pembetulan_ke: request.sptData.periodeData.pembetulanKe,
        },
        detail: request.sptData.detailData,
      },
      lampiran: request.attachments?.map((att) => ({
        jenis_dokumen: att.documentType,
        nama_file: att.fileName,
        file_base64: att.fileBase64,
        mime_type: att.mimeType,
      })),
      kuasa: request.poaNumber
        ? {
            nomor_surat_kuasa: request.poaNumber,
            npwp_kuasa: request.submittedBy.npwp,
            nama_kuasa: request.submittedBy.name,
            nomor_izin: request.submittedBy.licenseNumber,
          }
        : undefined,
    };
  }

  /**
   * Map internal tax type to SPT type
   */
  static mapTaxTypeToSPTType(taxType: string): SPTType {
    const typeMap: Record<string, SPTType> = {
      PPh21: 'SPT_MASA_PPH21',
      PPh23: 'SPT_MASA_PPH23',
      PPh_FINAL: 'SPT_MASA_PPH4_2',
      PPN: 'SPT_MASA_PPN',
      SPT_MASA: 'SPT_MASA_PPH21',
      SPT_TAHUNAN: 'SPT_TAHUNAN_1770SS',
      '1770': 'SPT_TAHUNAN_1770',
      '1770S': 'SPT_TAHUNAN_1770S',
      '1770SS': 'SPT_TAHUNAN_1770SS',
      '1771': 'SPT_TAHUNAN_1771',
    };
    return typeMap[taxType] || 'SPT_MASA_PPH21';
  }
}

// ============================================================================
// CUSTOM ERROR CLASSES
// ============================================================================

export class DJPError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DJPError';
  }
}

export class DJPAuthError extends DJPError {
  constructor(message: string, code?: string) {
    super(message, code);
    this.name = 'DJPAuthError';
  }
}

export class DJPValidationError extends DJPError {
  constructor(
    message: string,
    public validationErrors: Array<{ field: string; message: string }>
  ) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'DJPValidationError';
  }
}
