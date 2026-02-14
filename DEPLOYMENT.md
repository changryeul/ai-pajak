# AI PAJAK Deployment Guide

This guide covers deploying AI PAJAK to Vercel with all required configurations.

## Prerequisites

- [Vercel account](https://vercel.com)
- [Supabase project](https://supabase.com)
- [Midtrans account](https://midtrans.com) (for payments)
- [Resend account](https://resend.com) (for emails)
- [Sentry account](https://sentry.io) (optional, for error tracking)
- [Upstash account](https://upstash.com) (optional, for rate limiting)

## Quick Start

### 1. Import Project to Vercel

```bash
# Using Vercel CLI
npm i -g vercel
vercel link
vercel deploy
```

Or import directly from GitHub at [vercel.com/new](https://vercel.com/new).

### 2. Configure Environment Variables

Set these environment variables in your Vercel project settings:

#### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | `eyJ...` |
| `NEXT_PUBLIC_APP_URL` | Production URL | `https://app.aipajak.com` |

#### Payment (Midtrans)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` | Client key from Midtrans |
| `MIDTRANS_SERVER_KEY` | Server key from Midtrans |
| `MIDTRANS_MERCHANT_ID` | Merchant ID |

#### Email (Resend)

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Resend API key |
| `EMAIL_FROM` | Sender email address |
| `EMAIL_SUPPORT` | Support email address |

#### AI Services (Optional)

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key for GPT-4 Vision OCR |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |

#### Security

| Variable | Description |
|----------|-------------|
| `TWO_FACTOR_ENCRYPTION_KEY` | 32-byte encryption key for 2FA |
| `SESSION_SECRET` | Session signing secret |
| `CRON_SECRET` | Secret for cron job authentication |

#### Error Tracking (Sentry)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN |
| `SENTRY_ORG` | Sentry organization |
| `SENTRY_PROJECT` | Sentry project name |
| `SENTRY_AUTH_TOKEN` | Sentry auth token for source maps |

#### Rate Limiting (Upstash)

| Variable | Description |
|----------|-------------|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token |

### 3. Configure Supabase

#### Enable Required Extensions

```sql
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable Row Level Security
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;
```

#### Set Up Webhooks

Configure Supabase webhooks to point to your Vercel deployment:

1. Database webhooks for real-time sync
2. Auth webhooks for user events

### 4. Configure Midtrans Webhooks

In your Midtrans dashboard, set the notification URL to:

```
https://your-domain.vercel.app/api/webhooks/midtrans
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Vercel                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Next.js   │  │    API      │  │    Cron Jobs        │  │
│  │   Pages     │  │   Routes    │  │  (Vercel Cron)      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│         │                │                    │              │
│         └────────────────┼────────────────────┘              │
│                          │                                   │
└──────────────────────────│───────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
   ┌──────────┐     ┌──────────┐     ┌──────────┐
   │ Supabase │     │ Midtrans │     │  Resend  │
   │ Database │     │ Payment  │     │  Email   │
   │ + Auth   │     │          │     │          │
   └──────────┘     └──────────┘     └──────────┘
```

## Region Configuration

The app is configured to deploy to `sin1` (Singapore) for optimal latency to Indonesia.

To change the region, update `vercel.json`:

```json
{
  "regions": ["sin1"]
}
```

## Cron Jobs

The following cron jobs are configured:

| Job | Schedule | Description |
|-----|----------|-------------|
| `/api/cron/deadline-reminders` | Daily 8 AM | Send tax deadline reminders |
| `/api/cron/payment-reminders` | Daily 9 AM | Send payment reminders |
| `/api/cron/cleanup-expired-tokens` | Daily midnight | Clean up expired tokens |

## Function Configuration

Long-running API routes have extended timeouts:

| Route | Max Duration | Memory |
|-------|--------------|--------|
| `/api/tax/spt/**` | 60s | Default |
| `/api/documents/[id]/ocr` | 120s | 1024 MB |
| `/api/webhooks/**` | 30s | Default |
| `/api/djp/**` | 60s | Default |

## Security Features

### Headers

All responses include security headers:

- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Content-Security-Policy` (configured for Midtrans, Supabase, Sentry)

### API Security

- Rate limiting via Upstash Redis
- Request ID tracking for debugging
- CORS configured for allowed origins
- Webhook signature verification

## Monitoring

### Sentry Integration

Error tracking is automatically configured when `NEXT_PUBLIC_SENTRY_DSN` is set.

Source maps are uploaded during build when `SENTRY_AUTH_TOKEN` is configured.

### Logs

View logs in the Vercel dashboard or use the CLI:

```bash
vercel logs your-deployment-url
```

## Troubleshooting

### Build Failures

1. Check that all required environment variables are set
2. Verify Node.js version matches (18.x recommended)
3. Clear cache: `vercel --force`

### Runtime Errors

1. Check Vercel function logs
2. Verify Supabase connection
3. Check Sentry for detailed error reports

### Webhook Issues

1. Verify webhook URL is correct
2. Check signature verification
3. Ensure webhook secret is configured

## Rollback

To rollback to a previous deployment:

```bash
# List deployments
vercel list

# Promote a previous deployment
vercel promote <deployment-url>
```

## Preview Deployments

Every pull request automatically creates a preview deployment.

Preview URLs follow the pattern:
```
https://ai-pajak-<hash>-<team>.vercel.app
```

## Production Checklist

- [ ] All environment variables configured
- [ ] Supabase Row Level Security enabled
- [ ] Midtrans webhook URL configured
- [ ] Custom domain configured
- [ ] SSL certificate active
- [ ] Error tracking (Sentry) configured
- [ ] Rate limiting (Upstash) configured
- [ ] Backup strategy in place
- [ ] Monitoring alerts configured
