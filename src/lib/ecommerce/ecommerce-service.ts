/**
 * E-commerce Revenue Integration
 *
 * Connects to Indonesian e-commerce platforms for automatic revenue tracking.
 * Supported: Shopee, Tokopedia, TikTok Shop, Lazada, Bukalapak
 *
 * Integration methods:
 * 1. Direct API (Shopee Open Platform, Tokopedia OpenAPI)
 * 2. CSV/Excel import from seller dashboard
 * 3. Bank statement auto-detection (via BankingService)
 */

export type EcommercePlatform = 'SHOPEE' | 'TOKOPEDIA' | 'TIKTOK_SHOP' | 'LAZADA' | 'BUKALAPAK' | 'BLIBLI';

export interface EcommerceConnection {
  platform: EcommercePlatform;
  shopId: string;
  shopName: string;
  isConnected: boolean;
  lastSyncAt?: string;
}

export interface EcommerceOrder {
  orderId: string;
  platform: EcommercePlatform;
  orderDate: string;
  status: 'COMPLETED' | 'CANCELLED' | 'RETURNED' | 'PROCESSING';
  productName: string;
  quantity: number;
  grossAmount: number;
  platformFee: number;
  shippingFee: number;
  netAmount: number;
}

export interface EcommerceMonthlySummary {
  platform: EcommercePlatform;
  period: string; // YYYY-MM
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  grossRevenue: number;
  platformFees: number;
  shippingFees: number;
  netRevenue: number;
  pphFinal: number; // 0.5% of gross revenue
}

/**
 * Parse CSV export from e-commerce seller dashboard
 */
export function parseEcommerceCSV(
  csvContent: string,
  platform: EcommercePlatform
): EcommerceOrder[] {
  const lines = csvContent.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));

  return lines.slice(1).map((line) => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });

    return mapToOrder(row, platform);
  }).filter(o => o.orderId);
}

function mapToOrder(row: Record<string, string>, platform: EcommercePlatform): EcommerceOrder {
  const parseAmount = (v: string) => {
    const cleaned = v.replace(/[^\d.-]/g, '');
    return parseFloat(cleaned) || 0;
  };

  // Platform-specific field mapping
  switch (platform) {
    case 'SHOPEE':
      return {
        orderId: row['no. pesanan'] || row['order id'] || row['no pesanan'] || '',
        platform,
        orderDate: row['waktu pesanan dibuat'] || row['order creation date'] || '',
        status: mapStatus(row['status pesanan'] || row['order status'] || ''),
        productName: row['nama produk'] || row['product name'] || '',
        quantity: parseInt(row['jumlah'] || row['quantity'] || '1'),
        grossAmount: parseAmount(row['total pesanan'] || row['order total amount'] || '0'),
        platformFee: parseAmount(row['biaya layanan'] || row['service fee'] || '0'),
        shippingFee: parseAmount(row['biaya pengiriman'] || row['shipping fee'] || '0'),
        netAmount: parseAmount(row['estimasi pendapatan'] || row['estimated revenue'] || '0'),
      };

    case 'TOKOPEDIA':
      return {
        orderId: row['invoice'] || row['nomor invoice'] || '',
        platform,
        orderDate: row['tanggal pembayaran'] || row['payment date'] || '',
        status: mapStatus(row['status'] || ''),
        productName: row['nama produk'] || row['product name'] || '',
        quantity: parseInt(row['jumlah produk'] || row['qty'] || '1'),
        grossAmount: parseAmount(row['harga jual'] || row['selling price'] || '0'),
        platformFee: parseAmount(row['biaya layanan'] || '0'),
        shippingFee: parseAmount(row['biaya kirim'] || '0'),
        netAmount: parseAmount(row['total pendapatan'] || row['income'] || '0'),
      };

    default:
      return {
        orderId: row['order_id'] || row['id'] || '',
        platform,
        orderDate: row['date'] || row['tanggal'] || '',
        status: mapStatus(row['status'] || ''),
        productName: row['product'] || row['produk'] || '',
        quantity: parseInt(row['qty'] || row['quantity'] || '1'),
        grossAmount: parseAmount(row['total'] || row['amount'] || '0'),
        platformFee: parseAmount(row['fee'] || '0'),
        shippingFee: parseAmount(row['shipping'] || '0'),
        netAmount: parseAmount(row['net'] || row['revenue'] || '0'),
      };
  }
}

function mapStatus(status: string): EcommerceOrder['status'] {
  const s = status.toLowerCase();
  if (s.includes('selesai') || s.includes('completed') || s.includes('delivered')) return 'COMPLETED';
  if (s.includes('batal') || s.includes('cancel')) return 'CANCELLED';
  if (s.includes('retur') || s.includes('return')) return 'RETURNED';
  return 'PROCESSING';
}

/**
 * Calculate monthly summary from orders
 */
export function calculateMonthlySummary(
  orders: EcommerceOrder[],
  platform: EcommercePlatform,
  period: string
): EcommerceMonthlySummary {
  const completed = orders.filter(o => o.status === 'COMPLETED');
  const cancelled = orders.filter(o => o.status === 'CANCELLED');

  const grossRevenue = completed.reduce((s, o) => s + o.grossAmount, 0);
  const platformFees = completed.reduce((s, o) => s + o.platformFee, 0);
  const shippingFees = completed.reduce((s, o) => s + o.shippingFee, 0);
  const netRevenue = completed.reduce((s, o) => s + o.netAmount, 0);

  return {
    platform,
    period,
    totalOrders: orders.length,
    completedOrders: completed.length,
    cancelledOrders: cancelled.length,
    grossRevenue,
    platformFees,
    shippingFees,
    netRevenue: netRevenue || (grossRevenue - platformFees - shippingFees),
    pphFinal: Math.round(grossRevenue * 0.005),
  };
}
