/**
 * QR Code Generator for BPE
 *
 * Generates QR code data URLs for BPE verification
 */

import QRCode from 'qrcode';

export interface BPEVerificationData {
  bpeNumber: string;
  filingId: string;
  npwp: string;
  taxType: string;
  taxPeriod: string;
  taxYear: number;
  filedAt: string;
}

/**
 * Generate verification URL for BPE
 */
export function generateVerificationUrl(data: BPEVerificationData): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://aipajak.com';
  const params = new URLSearchParams({
    bpe: data.bpeNumber,
    filing: data.filingId,
  });
  return `${baseUrl}/verify/bpe?${params.toString()}`;
}

/**
 * Generate QR code as data URL for PDF embedding
 */
export async function generateBPEQRCode(data: BPEVerificationData): Promise<string> {
  const verificationUrl = generateVerificationUrl(data);

  try {
    const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 200,
      margin: 2,
      color: {
        dark: '#1a365d',
        light: '#ffffff',
      },
    });

    return qrCodeDataUrl;
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    // Return empty string if QR code generation fails
    return '';
  }
}

/**
 * Generate QR code as SVG string (for web display)
 */
export async function generateBPEQRCodeSVG(data: BPEVerificationData): Promise<string> {
  const verificationUrl = generateVerificationUrl(data);

  try {
    const svgString = await QRCode.toString(verificationUrl, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      width: 150,
      margin: 2,
      color: {
        dark: '#1a365d',
        light: '#ffffff',
      },
    });

    return svgString;
  } catch (error) {
    console.error('Failed to generate QR code SVG:', error);
    return '';
  }
}
