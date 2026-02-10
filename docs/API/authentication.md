# Authentication & Authorization

## Overview
AI-Pajak uses JWT (JSON Web Tokens) for authentication and Role-Based Access Control (RBAC) for authorization. This document covers all authentication flows, token management, and permission systems.

---

## Authentication Methods

### 1. Email & Password
Standard username/password authentication

### 2. OAuth 2.0 (Social Login)
- Google OAuth
- Microsoft OAuth

### 3. Biometric (Mobile)
- Face ID (iOS)
- Touch ID (iOS)
- Fingerprint (Android)

### 4. API Keys
- For server-to-server integration
- For webhook authentication

---

## Authentication Flow

### Login Flow

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Database

    Client->>API: POST /auth/login {email, password}
    API->>Database: Verify credentials
    Database-->>API: User data
    API->>API: Generate JWT tokens
    API-->>Client: {access_token, refresh_token}
    Client->>API: GET /clients (with access_token)
    API->>API: Verify token
    API-->>Client: Clients data
```

---

## Endpoints

### 1. Login

**Endpoint:** `POST /v1/auth/login`

**Request:**
```json
{
  "email": "user@company.com",
  "password": "SecurePassword123!",
  "remember_me": false
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 3600,
    "user": {
      "id": "user_123abc",
      "email": "user@company.com",
      "name": "Budi Santoso",
      "role": "tax_consultant",
      "permissions": ["clients:read", "clients:write", "filings:read", "filings:write"]
    }
  }
}
```

**Error Responses:**

**401 Unauthorized - Invalid Credentials**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

**423 Locked - Account Locked**
```json
{
  "success": false,
  "error": {
    "code": "ACCOUNT_LOCKED",
    "message": "Account locked due to multiple failed login attempts. Try again in 15 minutes.",
    "retry_after": 900
  }
}
```

---

### 2. Refresh Token

**Endpoint:** `POST /v1/auth/refresh`

**Request:**
```json
{
  "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 3600
  }
}
```

**Error Response:**

**401 Unauthorized - Invalid Refresh Token**
```json
{
  "success": false,
  "error": {
    "code": "TOKEN_INVALID",
    "message": "Refresh token is invalid or expired. Please login again."
  }
}
```

**Token Rotation:**
- New refresh token issued on each refresh
- Old refresh token invalidated
- Prevents token theft attacks

---

### 3. Logout

**Endpoint:** `POST /v1/auth/logout`

**Headers:**
```http
Authorization: Bearer {access_token}
```

**Request:**
```json
{
  "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "all_devices": false
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "message": "Successfully logged out"
  }
}
```

**Logout Options:**
- `all_devices: false` - Logout current session only
- `all_devices: true` - Logout all sessions/devices

---

### 4. Password Reset Request

**Endpoint:** `POST /v1/auth/password-reset`

**Request:**
```json
{
  "email": "user@company.com"
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "message": "Password reset link sent to your email"
  }
}
```

**Security:**
- Always returns success (even if email doesn't exist)
- Prevents email enumeration
- Token expires in 1 hour
- One-time use only

---

### 5. Password Reset Confirmation

**Endpoint:** `POST /v1/auth/password-reset/confirm`

**Request:**
```json
{
  "token": "reset_token_from_email",
  "password": "NewSecurePassword123!",
  "password_confirmation": "NewSecurePassword123!"
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "message": "Password successfully reset. You can now login with your new password."
  }
}
```

---

### 6. Change Password (Authenticated)

**Endpoint:** `POST /v1/auth/password-change`

**Headers:**
```http
Authorization: Bearer {access_token}
```

**Request:**
```json
{
  "current_password": "CurrentPassword123!",
  "new_password": "NewPassword123!",
  "new_password_confirmation": "NewPassword123!"
}
```

**Response: 200 OK**
```json
{
  "success": true,
  "data": {
    "message": "Password successfully changed"
  }
}
```

---

### 7. Email Verification

**Send Verification Email:**
```http
POST /v1/auth/email/verification-notification
Authorization: Bearer {access_token}
```

**Verify Email:**
```http
GET /v1/auth/email/verify/{token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Email successfully verified",
    "verified_at": "2025-12-23T10:00:00Z"
  }
}
```

---

## OAuth 2.0 Flows

### Google OAuth

**Step 1: Initiate OAuth**
```http
GET /v1/auth/google/redirect
```

**Response:** Redirect to Google OAuth consent page

**Step 2: OAuth Callback**
```http
GET /v1/auth/google/callback?code={auth_code}&state={state}
```

**Response:** Redirect to frontend with tokens
```
https://app.ai-pajak.com/auth/callback?access_token={token}&refresh_token={token}
```

### Microsoft OAuth

**Step 1: Initiate OAuth**
```http
GET /v1/auth/microsoft/redirect
```

**Step 2: OAuth Callback**
```http
GET /v1/auth/microsoft/callback?code={auth_code}&state={state}
```

**Account Linking:**
If email already exists, link OAuth provider to existing account.

---

## Biometric Authentication (Mobile)

### Setup Biometric

**Endpoint:** `POST /v1/auth/biometric/setup`

**Request:**
```json
{
  "device_id": "device_uuid",
  "public_key": "base64_encoded_public_key",
  "biometric_type": "face_id"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "biometric_id": "bio_123abc",
    "enabled": true
  }
}
```

### Authenticate with Biometric

**Endpoint:** `POST /v1/auth/biometric/authenticate`

**Request:**
```json
{
  "device_id": "device_uuid",
  "challenge": "base64_encoded_challenge",
  "signature": "base64_encoded_signature"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 3600
  }
}
```

---

## JWT Token Structure

### Access Token Payload
```json
{
  "sub": "user_123abc",
  "email": "user@company.com",
  "name": "Budi Santoso",
  "role": "tax_consultant",
  "permissions": [
    "clients:read",
    "clients:write",
    "filings:read",
    "filings:write"
  ],
  "org_id": "org_456def",
  "iat": 1703329200,
  "exp": 1703332800,
  "iss": "https://api.ai-pajak.com",
  "aud": "https://app.ai-pajak.com"
}
```

### Refresh Token Payload
```json
{
  "sub": "user_123abc",
  "token_id": "refresh_789xyz",
  "iat": 1703329200,
  "exp": 1705921200,
  "iss": "https://api.ai-pajak.com"
}
```

### Token Specifications
- **Algorithm:** RS256 (RSA with SHA-256)
- **Access Token TTL:** 1 hour (3600 seconds)
- **Refresh Token TTL:** 30 days (2592000 seconds)
- **Issuer:** `https://api.ai-pajak.com`
- **Audience:** `https://app.ai-pajak.com`

---

## Using Tokens

### Request with Bearer Token

```http
GET /v1/clients HTTP/1.1
Host: api.ai-pajak.com
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

### Token Validation
Server validates:
1. Token signature (RSA verification)
2. Token expiration (`exp` claim)
3. Token issuer (`iss` claim)
4. Token audience (`aud` claim)
5. User still active (not disabled/deleted)
6. Permissions for requested resource

---

## Authorization & Permissions

### Role-Based Access Control (RBAC)

**Roles:**
```
admin              - Full system access
tax_consultant     - Manage clients, filings, team
accountant         - Complete tasks, submit filings
executive          - View reports, approve filings
client             - View own data, upload documents
```

### Permissions Structure
Format: `resource:action`

**Common Permissions:**
```
clients:read       - View clients
clients:write      - Create/update clients
clients:delete     - Delete clients

filings:read       - View tax filings
filings:write      - Create/update filings
filings:submit     - Submit filings to DJP
filings:approve    - Approve filings
filings:delete     - Delete filings

documents:read     - View documents
documents:write    - Upload documents
documents:delete   - Delete documents

users:read         - View users
users:write        - Create/update users
users:delete       - Delete users

reports:read       - View reports
reports:export     - Export reports

settings:read      - View settings
settings:write     - Update settings
```

### Permission Checking

**Server-Side:**
```javascript
// Middleware checks user permissions
if (!user.hasPermission('clients:write')) {
  return res.status(403).json({
    success: false,
    error: {
      code: 'INSUFFICIENT_PERMISSIONS',
      message: 'You do not have permission to perform this action'
    }
  });
}
```

**Client-Side:**
```javascript
// Check permission before showing UI
if (user.permissions.includes('clients:write')) {
  // Show "Create Client" button
}
```

---

## Role-Permission Matrix

| Permission | Admin | Tax Consultant | Accountant | Executive | Client |
|-----------|-------|----------------|------------|-----------|--------|
| clients:read | ✓ | ✓ | ✓ (assigned) | ✗ | ✓ (self) |
| clients:write | ✓ | ✓ | ✗ | ✗ | ✗ |
| clients:delete | ✓ | ✓ | ✗ | ✗ | ✗ |
| filings:read | ✓ | ✓ | ✓ (assigned) | ✓ (own) | ✓ (own) |
| filings:write | ✓ | ✓ | ✓ (assigned) | ✗ | ✗ |
| filings:submit | ✓ | ✓ | ✗ | ✗ | ✗ |
| filings:approve | ✓ | ✓ | ✗ | ✓ | ✗ |
| documents:read | ✓ | ✓ | ✓ | ✓ | ✓ (own) |
| documents:write | ✓ | ✓ | ✓ | ✗ | ✓ |
| users:write | ✓ | ✓ (limited) | ✗ | ✗ | ✗ |
| reports:read | ✓ | ✓ | ✓ (limited) | ✓ | ✗ |
| settings:write | ✓ | ✗ | ✗ | ✗ | ✗ |

---

## API Keys (Server-to-Server)

### Create API Key

**Endpoint:** `POST /v1/auth/api-keys`

**Request:**
```json
{
  "name": "Integration Server",
  "scopes": ["clients:read", "filings:read"],
  "expires_at": "2026-12-23T00:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "key_123abc",
    "name": "Integration Server",
    "api_key": "ak_live_1234567890abcdef",
    "scopes": ["clients:read", "filings:read"],
    "created_at": "2025-12-23T10:00:00Z",
    "expires_at": "2026-12-23T00:00:00Z"
  }
}
```

**Important:** API key shown only once. Store securely.

### Use API Key

```http
GET /v1/clients HTTP/1.1
Host: api.ai-pajak.com
Authorization: Bearer ak_live_1234567890abcdef
```

### List API Keys

```http
GET /v1/auth/api-keys
```

### Revoke API Key

```http
DELETE /v1/auth/api-keys/{key_id}
```

---

## Security Best Practices

### Token Security
1. **Never expose tokens in URLs** - Use headers only
2. **Store tokens securely** - httpOnly cookies or secure storage
3. **Use HTTPS only** - Never transmit over HTTP
4. **Implement token rotation** - Refresh tokens regularly
5. **Set appropriate expiration** - Short-lived access tokens

### Password Security
1. **Minimum requirements** - 8 chars, upper, lower, number
2. **Hash with bcrypt** - Cost factor 12+
3. **Never log passwords** - Not even encrypted
4. **Rate limit attempts** - 5 failures = temporary lock
5. **Check breach database** - Have I Been Pwned API

### Session Management
1. **Unique session IDs** - Cryptographically random
2. **Session timeout** - 30 minutes inactive, 24 hours absolute
3. **Secure cookies** - httpOnly, Secure, SameSite=Strict
4. **Logout all devices** - Invalidate all tokens on password change
5. **Monitor suspicious activity** - Unusual locations, devices

---

## Rate Limiting

### Login Attempts
- **Limit:** 5 attempts per 15 minutes
- **Lockout:** 15 minutes after 5 failures
- **Escalation:** 1 hour after 10 failures

### Password Reset
- **Limit:** 3 requests per hour per email
- **Cooldown:** 1 hour

### Token Refresh
- **Limit:** 10 refreshes per hour
- **Detection:** Flag unusual refresh patterns

---

## Multi-Factor Authentication (MFA)

### Setup TOTP

**Endpoint:** `POST /v1/auth/mfa/totp/setup`

**Response:**
```json
{
  "success": true,
  "data": {
    "secret": "BASE32_ENCODED_SECRET",
    "qr_code": "data:image/png;base64,...",
    "backup_codes": [
      "12345678",
      "23456789",
      "34567890"
    ]
  }
}
```

### Verify TOTP Setup

**Endpoint:** `POST /v1/auth/mfa/totp/verify`

**Request:**
```json
{
  "code": "123456"
}
```

### Login with MFA

After initial login, prompt for MFA code:

**Endpoint:** `POST /v1/auth/mfa/verify`

**Request:**
```json
{
  "session_token": "temp_session_token",
  "code": "123456"
}
```

**Response:** Full access tokens

---

## Audit Logging

All authentication events logged:
- Login attempts (success/failure)
- Token refresh
- Logout
- Password changes
- MFA setup/verification
- API key creation/revocation
- Suspicious activities

**Log Entry Example:**
```json
{
  "timestamp": "2025-12-23T10:00:00Z",
  "event": "login_success",
  "user_id": "user_123",
  "email": "user@company.com",
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "location": "Jakarta, Indonesia",
  "device_id": "device_uuid",
  "session_id": "session_abc"
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| INVALID_CREDENTIALS | 401 | Invalid email or password |
| TOKEN_EXPIRED | 401 | Access token expired |
| TOKEN_INVALID | 401 | Token invalid or malformed |
| INSUFFICIENT_PERMISSIONS | 403 | Lacks required permissions |
| ACCOUNT_LOCKED | 423 | Account temporarily locked |
| ACCOUNT_DISABLED | 403 | Account permanently disabled |
| EMAIL_NOT_VERIFIED | 403 | Email verification required |
| MFA_REQUIRED | 403 | MFA verification required |
| MFA_INVALID | 401 | Invalid MFA code |

---

## Related Documentation
- [API Overview](./README.md)
- [REST API Specification](./rest-api-spec.md)
- [User Management API](./endpoints/user-api.md)
- [Security Best Practices](../../03-technical/security.md)

---

**Document Version:** 1.0
**Last Updated:** 2025-12-23
**Maintained By:** Security Team
