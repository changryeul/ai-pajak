/**
 * Payment Initiation API
 *
 * POST /api/payment/initiate
 *
 * Creates a Midtrans Snap payment token for a pending billing transaction.
 * Users can then complete payment through the Midtrans payment popup.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { MidtransService } from '@/lib/payment/midtrans';

interface PaymentInitiateRequest {
  transactionId: string;
}

interface PaymentInitiateResponse {
  success: boolean;
  data: {
    transactionId: string;
    paymentToken: string;
    paymentUrl: string;
    expiresAt: string;
  };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Check authentication
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as PaymentInitiateRequest;
  const { transactionId } = body;

  if (!transactionId) {
    return NextResponse.json(
      { error: 'Transaction ID is required' },
      { status: 400 }
    );
  }

  // Get user's customer ID
  const { data: profile } = await supabase
    .from('user_profile')
    .select('customer_id')
    .eq('user_id', session.user.id)
    .single();

  if (!profile?.customer_id) {
    return NextResponse.json(
      { error: 'Customer profile not found' },
      { status: 404 }
    );
  }

  // Get the billing transaction
  const { data: transaction, error: transactionError } = await supabase
    .from('billing_transaction')
    .select(
      `
      id,
      invoice_number,
      customer_id,
      amount_total,
      service_type,
      description,
      payment_status,
      due_date,
      customer:customer_id (
        id,
        full_name,
        email,
        phone
      )
    `
    )
    .eq('id', transactionId)
    .single();

  if (transactionError || !transaction) {
    return NextResponse.json(
      { error: 'Transaction not found', transactionId },
      { status: 404 }
    );
  }

  // Verify the transaction belongs to the user
  if (transaction.customer_id !== profile.customer_id) {
    return NextResponse.json(
      { error: 'Transaction does not belong to this customer' },
      { status: 403 }
    );
  }

  // Check if already paid
  if (transaction.payment_status === 'PAID') {
    return NextResponse.json(
      { error: 'Transaction already paid', paymentStatus: 'PAID' },
      { status: 400 }
    );
  }

  // Check if expired or cancelled
  if (['CANCELLED', 'EXPIRED', 'REFUNDED'].includes(transaction.payment_status)) {
    return NextResponse.json(
      {
        error: 'Transaction cannot be paid',
        paymentStatus: transaction.payment_status,
      },
      { status: 400 }
    );
  }

  // Extract customer details
  type CustomerData = {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
  };
  const customerData = transaction.customer as unknown;
  const customer = Array.isArray(customerData)
    ? (customerData[0] as CustomerData | undefined)
    : (customerData as CustomerData | null);

  if (!customer) {
    return NextResponse.json(
      { error: 'Customer data not found' },
      { status: 500 }
    );
  }

  // Split full name into first/last
  const nameParts = customer.full_name.split(' ');
  const firstName = nameParts[0] || 'Customer';
  const lastName = nameParts.slice(1).join(' ') || '';

  try {
    // Create Midtrans Snap transaction
    const midtransResponse = await MidtransService.createSnapTransaction({
      orderId: `PAY-${transaction.id}-${Date.now()}`,
      grossAmount: transaction.amount_total,
      customerDetails: {
        firstName,
        lastName,
        email: customer.email,
        phone: customer.phone,
      },
      itemDetails: [
        {
          id: transaction.id,
          name: `${transaction.service_type}: ${transaction.description}`.substring(0, 50),
          price: transaction.amount_total,
          quantity: 1,
        },
      ],
    });

    // Update transaction with payment token
    await supabase
      .from('billing_transaction')
      .update({
        payment_token: midtransResponse.token,
        payment_url: midtransResponse.redirect_url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transactionId);

    // Calculate expiry (Midtrans Snap tokens expire in 24 hours)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const response: PaymentInitiateResponse = {
      success: true,
      data: {
        transactionId: transaction.id,
        paymentToken: midtransResponse.token,
        paymentUrl: midtransResponse.redirect_url,
        expiresAt: expiresAt.toISOString(),
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[PAYMENT] Midtrans transaction creation failed:', error);
    return NextResponse.json(
      {
        error: 'Failed to create payment',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
