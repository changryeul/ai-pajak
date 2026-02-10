# Billing & Subscription API

## Overview
The Billing API manages subscriptions, invoices, payments, and usage tracking for the AI-Pajak platform. It integrates with payment gateways and handles Indonesian payment methods.

**Base Path:** `/v1/billing`

---

## Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/subscriptions` | List subscriptions |
| GET | `/subscriptions/{id}` | Get subscription details |
| POST | `/subscriptions` | Create subscription |
| PATCH | `/subscriptions/{id}` | Update subscription |
| POST | `/subscriptions/{id}/cancel` | Cancel subscription |
| POST | `/subscriptions/{id}/upgrade` | Upgrade plan |
| POST | `/subscriptions/{id}/downgrade` | Downgrade plan |
| GET | `/invoices` | List invoices |
| GET | `/invoices/{id}` | Get invoice details |
| POST | `/invoices/{id}/pay` | Pay invoice |
| GET | `/invoices/{id}/download` | Download invoice PDF |
| GET | `/payment-methods` | List payment methods |
| POST | `/payment-methods` | Add payment method |
| DELETE | `/payment-methods/{id}` | Remove payment method |
| POST | `/payment-methods/{id}/set-default` | Set default payment |
| GET | `/usage` | Get usage statistics |
| GET | `/billing-history` | Get billing history |

---

## Data Models

### Subscription Object

```json
{
  "id": "sub_123abc",
  "organization_id": "org_456def",
  "plan": {
    "id": "plan_pro",
    "name": "Professional",
    "tier": "professional",
    "price": 2500000,
    "currency": "IDR",
    "interval": "month",
    "features": {
      "max_clients": 50,
      "max_users": 10,
      "max_filings_per_month": 200,
      "ai_validation": true,
      "api_access": true,
      "priority_support": true,
      "white_label": false
    }
  },
  "status": "active",
  "billing_cycle_start": "2025-01-01",
  "billing_cycle_end": "2025-01-31",
  "current_period_start": "2025-12-01T00:00:00Z",
  "current_period_end": "2025-12-31T23:59:59Z",
  "trial_end": null,
  "cancel_at_period_end": false,
  "canceled_at": null,
  "payment_method": {
    "id": "pm_789ghi",
    "type": "credit_card",
    "last4": "4242",
    "brand": "Visa"
  },
  "discount": {
    "id": "discount_111",
    "code": "WELCOME2025",
    "percent_off": 20,
    "valid_until": "2026-01-01T00:00:00Z"
  },
  "usage": {
    "clients": 42,
    "users": 8,
    "filings_this_month": 156,
    "api_calls_this_month": 8500
  },
  "next_invoice": {
    "date": "2026-01-01",
    "amount": 2000000,
    "currency": "IDR"
  },
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-12-23T10:00:00Z"
}
```

### Plans & Pricing

```json
{
  "plans": [
    {
      "id": "plan_free",
      "name": "Free Trial",
      "tier": "free",
      "price": 0,
      "currency": "IDR",
      "interval": "month",
      "trial_days": 30,
      "features": {
        "max_clients": 5,
        "max_users": 2,
        "max_filings_per_month": 20,
        "ai_validation": true,
        "api_access": false,
        "priority_support": false,
        "white_label": false
      }
    },
    {
      "id": "plan_basic",
      "name": "Basic",
      "tier": "basic",
      "price": 500000,
      "currency": "IDR",
      "interval": "month",
      "features": {
        "max_clients": 20,
        "max_users": 5,
        "max_filings_per_month": 80,
        "ai_validation": true,
        "api_access": false,
        "priority_support": false,
        "white_label": false
      }
    },
    {
      "id": "plan_pro",
      "name": "Professional",
      "tier": "professional",
      "price": 2500000,
      "currency": "IDR",
      "interval": "month",
      "annual_price": 25000000,
      "annual_discount": 0.167,
      "features": {
        "max_clients": 50,
        "max_users": 10,
        "max_filings_per_month": 200,
        "ai_validation": true,
        "api_access": true,
        "priority_support": true,
        "white_label": false
      }
    },
    {
      "id": "plan_enterprise",
      "name": "Enterprise",
      "tier": "enterprise",
      "price": null,
      "currency": "IDR",
      "interval": "custom",
      "features": {
        "max_clients": "unlimited",
        "max_users": "unlimited",
        "max_filings_per_month": "unlimited",
        "ai_validation": true,
        "api_access": true,
        "priority_support": true,
        "white_label": true,
        "dedicated_account_manager": true,
        "custom_integrations": true,
        "sla_guarantee": true
      }
    }
  ]
}
```

### Invoice Object

```json
{
  "id": "inv_123abc",
  "number": "INV-2025-12-001",
  "subscription_id": "sub_456def",
  "organization_id": "org_789ghi",
  "organization": {
    "name": "Tax Consultant Firm",
    "npwp": "01.234.567.8-901.000",
    "address": "Jl. Sudirman No. 123, Jakarta"
  },
  "status": "paid",
  "amount_due": 2500000,
  "amount_paid": 2500000,
  "currency": "IDR",
  "tax": {
    "ppn": 275000,
    "ppn_rate": 0.11,
    "subtotal": 2500000,
    "total": 2775000
  },
  "line_items": [
    {
      "description": "Professional Plan - December 2025",
      "quantity": 1,
      "unit_price": 2500000,
      "amount": 2500000
    }
  ],
  "discount": {
    "code": "WELCOME2025",
    "amount": 500000
  },
  "period_start": "2025-12-01T00:00:00Z",
  "period_end": "2025-12-31T23:59:59Z",
  "due_date": "2025-12-07T23:59:59Z",
  "paid_at": "2025-12-01T10:30:00Z",
  "payment_method": {
    "type": "credit_card",
    "last4": "4242"
  },
  "pdf_url": "https://invoices.ai-pajak.com/inv_123abc.pdf",
  "created_at": "2025-12-01T00:00:00Z"
}
```

### Payment Method Object

```json
{
  "id": "pm_123abc",
  "type": "credit_card",
  "card": {
    "brand": "Visa",
    "last4": "4242",
    "exp_month": 12,
    "exp_year": 2027,
    "country": "ID"
  },
  "billing_details": {
    "name": "Budi Santoso",
    "email": "budi@company.com",
    "phone": "+62-812-3456-7890",
    "address": {
      "city": "Jakarta",
      "country": "ID",
      "postal_code": "12190"
    }
  },
  "is_default": true,
  "created_at": "2025-01-01T00:00:00Z"
}
```

---

## Get Subscription

**Endpoint:** `GET /v1/subscriptions/{id}`

**Permission:** `billing:read`

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "id": "sub_123abc",
    "plan": {
      "id": "plan_pro",
      "name": "Professional",
      "price": 2500000,
      "currency": "IDR"
    },
    "status": "active",
    "current_period_start": "2025-12-01T00:00:00Z",
    "current_period_end": "2025-12-31T23:59:59Z",
    "usage": {
      "clients": 42,
      "users": 8,
      "filings_this_month": 156,
      "limits": {
        "max_clients": 50,
        "max_users": 10,
        "max_filings_per_month": 200
      },
      "usage_percentage": {
        "clients": 84,
        "users": 80,
        "filings": 78
      }
    },
    "next_invoice": {
      "date": "2026-01-01",
      "amount": 2500000,
      "currency": "IDR"
    }
  }
}
```

---

## Create Subscription

**Endpoint:** `POST /v1/subscriptions`

**Permission:** `billing:write`

**Request:**
```json
{
  "plan_id": "plan_pro",
  "interval": "month",
  "payment_method_id": "pm_789ghi",
  "coupon_code": "WELCOME2025",
  "trial_days": 0
}
```

**Response: 201 Created**
```json
{
  "success": true,
  "data": {
    "id": "sub_123abc",
    "plan": {
      "id": "plan_pro",
      "name": "Professional"
    },
    "status": "active",
    "trial_end": null,
    "current_period_start": "2025-12-23T10:00:00Z",
    "current_period_end": "2026-01-23T10:00:00Z",
    "first_invoice": {
      "id": "inv_123",
      "amount": 2000000,
      "due_date": "2025-12-30T00:00:00Z"
    }
  }
}
```

**Trial Subscription:**
```json
{
  "plan_id": "plan_pro",
  "trial_days": 30
}
```

---

## Update Subscription

**Endpoint:** `PATCH /v1/subscriptions/{id}`

**Permission:** `billing:write`

**Request:**
```json
{
  "payment_method_id": "pm_new_999",
  "coupon_code": "SAVE20"
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "id": "sub_123abc",
    "payment_method": {
      "id": "pm_new_999",
      "type": "credit_card",
      "last4": "5555"
    },
    "discount": {
      "code": "SAVE20",
      "percent_off": 20
    },
    "updated_at": "2025-12-23T10:00:00Z"
  }
}
```

---

## Upgrade Plan

**Endpoint:** `POST /v1/subscriptions/{id}/upgrade`

**Permission:** `billing:write`

**Request:**
```json
{
  "plan_id": "plan_enterprise",
  "prorate": true
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "id": "sub_123abc",
    "plan": {
      "id": "plan_enterprise",
      "name": "Enterprise"
    },
    "status": "active",
    "prorated_charge": {
      "amount": 5000000,
      "description": "Prorated upgrade from Professional to Enterprise",
      "invoice_id": "inv_prorate_456"
    },
    "effective_date": "2025-12-23T10:00:00Z"
  }
}
```

**Proration:**
- Immediate upgrade with prorated charge
- Credit for unused time on old plan
- Charge for remaining time on new plan

---

## Downgrade Plan

**Endpoint:** `POST /v1/subscriptions/{id}/downgrade`

**Permission:** `billing:write`

**Request:**
```json
{
  "plan_id": "plan_basic",
  "at_period_end": true
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "id": "sub_123abc",
    "current_plan": {
      "id": "plan_pro",
      "name": "Professional"
    },
    "pending_downgrade": {
      "plan_id": "plan_basic",
      "effective_date": "2026-01-01T00:00:00Z"
    },
    "message": "Your plan will downgrade to Basic at the end of the current billing period"
  }
}
```

**Options:**
- `at_period_end: true` - Downgrade at next billing cycle
- `at_period_end: false` - Immediate downgrade with credit

---

## Cancel Subscription

**Endpoint:** `POST /v1/subscriptions/{id}/cancel`

**Permission:** `billing:write`

**Request:**
```json
{
  "at_period_end": true,
  "reason": "switching_service",
  "feedback": "Moving to in-house solution"
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "id": "sub_123abc",
    "status": "active",
    "cancel_at_period_end": true,
    "canceled_at": "2025-12-23T10:00:00Z",
    "ends_at": "2026-01-01T00:00:00Z",
    "message": "Your subscription will remain active until January 1, 2026"
  }
}
```

**Cancellation Reasons:**
- `too_expensive`
- `missing_features`
- `switching_service`
- `no_longer_needed`
- `poor_support`
- `other`

---

## List Invoices

**Endpoint:** `GET /v1/invoices`

**Permission:** `billing:read`

**Query Parameters:**
```
status=paid,unpaid
subscription_id=sub_123abc
date_from=2025-01-01
date_to=2025-12-31
page=1
per_page=20
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": [
    {
      "id": "inv_123",
      "number": "INV-2025-12-001",
      "status": "paid",
      "amount_due": 2775000,
      "currency": "IDR",
      "due_date": "2025-12-07T23:59:59Z",
      "paid_at": "2025-12-01T10:30:00Z",
      "pdf_url": "https://invoices.ai-pajak.com/inv_123.pdf"
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 12
  }
}
```

---

## Get Invoice

**Endpoint:** `GET /v1/invoices/{id}`

**Permission:** `billing:read`

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "id": "inv_123abc",
    "number": "INV-2025-12-001",
    "status": "paid",
    "amount_due": 2775000,
    "amount_paid": 2775000,
    "currency": "IDR",
    "tax": {
      "ppn": 275000,
      "ppn_rate": 0.11
    },
    "line_items": [
      {
        "description": "Professional Plan - December 2025",
        "quantity": 1,
        "unit_price": 2500000,
        "amount": 2500000
      }
    ],
    "due_date": "2025-12-07T23:59:59Z",
    "paid_at": "2025-12-01T10:30:00Z",
    "pdf_url": "https://invoices.ai-pajak.com/inv_123abc.pdf"
  }
}
```

---

## Pay Invoice

**Endpoint:** `POST /v1/invoices/{id}/pay`

**Permission:** `billing:write`

**Request:**
```json
{
  "payment_method_id": "pm_789ghi"
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "invoice_id": "inv_123abc",
    "status": "paid",
    "amount_paid": 2775000,
    "payment_method": {
      "type": "credit_card",
      "last4": "4242"
    },
    "paid_at": "2025-12-23T10:00:00Z",
    "receipt_url": "https://receipts.ai-pajak.com/receipt_123.pdf"
  }
}
```

**Payment Processing:**
1. Charge payment method
2. Update invoice status
3. Send receipt email
4. Emit webhook event

---

## Add Payment Method

**Endpoint:** `POST /v1/payment-methods`

**Permission:** `billing:write`

**Request (Credit Card):**
```json
{
  "type": "credit_card",
  "card": {
    "number": "4242424242424242",
    "exp_month": 12,
    "exp_year": 2027,
    "cvc": "123"
  },
  "billing_details": {
    "name": "Budi Santoso",
    "email": "budi@company.com",
    "phone": "+62-812-3456-7890"
  },
  "set_as_default": true
}
```

**Request (Bank Transfer):**
```json
{
  "type": "bank_transfer",
  "bank": {
    "name": "BCA",
    "account_number": "1234567890",
    "account_holder": "PT Maju Jaya"
  },
  "set_as_default": false
}
```

**Response: 201 Created**
```json
{
  "success": true,
  "data": {
    "id": "pm_123abc",
    "type": "credit_card",
    "card": {
      "brand": "Visa",
      "last4": "4242",
      "exp_month": 12,
      "exp_year": 2027
    },
    "is_default": true,
    "created_at": "2025-12-23T10:00:00Z"
  }
}
```

**Supported Payment Methods:**
- Credit/Debit Cards (Visa, Mastercard, JCB)
- Bank Transfer (BCA, Mandiri, BNI, BRI)
- E-Wallets (GoPay, OVO, DANA)
- Virtual Account

---

## Get Usage Statistics

**Endpoint:** `GET /v1/usage`

**Permission:** `billing:read`

**Query Parameters:**
```
period=current_month
granularity=day
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2025-12-01T00:00:00Z",
      "end": "2025-12-31T23:59:59Z"
    },
    "current_usage": {
      "clients": 42,
      "users": 8,
      "filings": 156,
      "api_calls": 8500,
      "storage_gb": 12.5
    },
    "limits": {
      "clients": 50,
      "users": 10,
      "filings": 200,
      "api_calls": 10000,
      "storage_gb": 50
    },
    "usage_percentage": {
      "clients": 84,
      "users": 80,
      "filings": 78,
      "api_calls": 85,
      "storage": 25
    },
    "overage": {
      "api_calls": 0,
      "storage": 0,
      "charges": 0
    },
    "daily_breakdown": [
      {
        "date": "2025-12-01",
        "filings": 8,
        "api_calls": 420
      },
      {
        "date": "2025-12-02",
        "filings": 12,
        "api_calls": 580
      }
    ]
  }
}
```

---

## Billing History

**Endpoint:** `GET /v1/billing-history`

**Permission:** `billing:read`

**Response: 200 OK**
```json
{
  "success": true,
  "data": [
    {
      "id": "payment_789",
      "type": "subscription_payment",
      "description": "Professional Plan - December 2025",
      "amount": 2775000,
      "currency": "IDR",
      "status": "succeeded",
      "invoice_id": "inv_123",
      "payment_method": {
        "type": "credit_card",
        "last4": "4242"
      },
      "created_at": "2025-12-01T10:00:00Z"
    },
    {
      "id": "payment_788",
      "type": "subscription_payment",
      "description": "Professional Plan - November 2025",
      "amount": 2775000,
      "currency": "IDR",
      "status": "succeeded",
      "created_at": "2025-11-01T10:00:00Z"
    }
  ]
}
```

---

## Webhooks

Events emitted for billing:

- `subscription.created`
- `subscription.updated`
- `subscription.canceled`
- `subscription.trial_ending` (3 days before)
- `invoice.created`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `invoice.upcoming` (7 days before)
- `payment_method.added`
- `payment_method.removed`
- `usage.limit_approaching` (90% of limit)
- `usage.limit_exceeded`

---

## Payment Failures

### Failed Payment Handling

**Auto-Retry Schedule:**
1. Immediate retry
2. After 3 days
3. After 5 days
4. After 7 days

**Subscription Status During Failure:**
- Days 0-7: Active (grace period)
- Days 8-14: Past due (limited access)
- Day 15+: Suspended (read-only access)
- Day 30: Canceled

### Dunning Email Sequence
1. Day 1: Payment failed notification
2. Day 3: First reminder
3. Day 7: Final reminder
4. Day 14: Suspension warning
5. Day 30: Cancellation notice

---

## Proration Logic

### Upgrade Proration Example
Current plan: Basic (Rp 500,000/month)
New plan: Professional (Rp 2,500,000/month)
Days remaining in period: 15 days (out of 30)

```
Credit for unused Basic: (500,000 / 30) × 15 = Rp 250,000
Charge for Pro period: (2,500,000 / 30) × 15 = Rp 1,250,000
Prorated amount due: Rp 1,250,000 - Rp 250,000 = Rp 1,000,000
```

### Downgrade Proration
- Default: Apply at next billing cycle
- Optional: Immediate with credit to account balance

---

## Tax Calculations

### Indonesian VAT (PPN)
- Rate: 11% (as of 2025)
- Applied to all subscriptions
- Invoices include tax breakdown

**Calculation:**
```
Subtotal: Rp 2,500,000
PPN (11%): Rp 275,000
Total: Rp 2,775,000
```

---

## Coupons & Discounts

### Create Coupon

**Endpoint:** `POST /v1/coupons`

**Request:**
```json
{
  "code": "NEWYEAR2026",
  "percent_off": 25,
  "duration": "once",
  "max_redemptions": 100,
  "valid_until": "2026-01-31T23:59:59Z"
}
```

**Duration Options:**
- `once` - Apply to first invoice only
- `repeating` - Apply for specified months
- `forever` - Apply to all invoices

---

## Related Documentation
- [API Overview](/Users/tommy/git/ai-pajak/docs/02-design/api/README.md)
- [Authentication](/Users/tommy/git/ai-pajak/docs/02-design/api/authentication.md)
- [Webhooks](/Users/tommy/git/ai-pajak/docs/02-design/api/webhooks.md)

---

**Document Version:** 1.0
**Last Updated:** 2025-12-23
**Maintained By:** Billing Team
