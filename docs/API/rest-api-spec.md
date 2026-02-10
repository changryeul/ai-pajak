# REST API Specification

## Overview
This document defines the REST API conventions, standards, and best practices for the AI-Pajak platform. All API endpoints must adhere to these specifications.

---

## API Design Principles

### 1. Resource-Oriented Design
- URLs represent resources (nouns), not actions (verbs)
- Use HTTP methods for actions
- Maintain consistent resource hierarchies

**Good:**
```
GET    /v1/clients/{id}
POST   /v1/tax-filings
PATCH  /v1/tax-filings/{id}
```

**Bad:**
```
GET    /v1/getClient?id=123
POST   /v1/createTaxFiling
POST   /v1/updateTaxFiling
```

### 2. HTTP Method Semantics
| Method | Purpose | Idempotent | Safe |
|--------|---------|-----------|------|
| GET | Retrieve resource(s) | Yes | Yes |
| POST | Create new resource | No | No |
| PUT | Replace entire resource | Yes | No |
| PATCH | Partial update | No | No |
| DELETE | Remove resource | Yes | No |
| HEAD | Get headers only | Yes | Yes |
| OPTIONS | Get allowed methods | Yes | Yes |

### 3. Stateless
- Each request contains all necessary information
- No server-side session state
- Use JWT tokens for authentication
- Client maintains state

### 4. Cacheable
- Use appropriate cache headers
- ETags for conditional requests
- Cache-Control headers
- Last-Modified timestamps

---

## URL Structure

### Base Pattern
```
https://api.ai-pajak.com/{version}/{resource}/{id}/{sub-resource}
```

### Examples
```
/v1/clients
/v1/clients/{client_id}
/v1/clients/{client_id}/tax-filings
/v1/clients/{client_id}/tax-filings/{filing_id}
/v1/tax-filings/{filing_id}/documents
/v1/tax-filings/{filing_id}/documents/{document_id}
```

### Naming Conventions
- Use plural nouns for collections: `/clients`, `/tax-filings`
- Use lowercase and hyphens: `/tax-filings` not `/taxFilings` or `/tax_filings`
- Keep URLs short and intuitive
- Max 3 levels of nesting (avoid: `/v1/a/b/c/d/e`)

---

## Request Format

### Headers

#### Required Headers
```http
Content-Type: application/json
Authorization: Bearer {access_token}
Accept: application/json
```

#### Optional Headers
```http
X-Request-ID: unique-request-id
X-Idempotency-Key: unique-key-for-post
Accept-Language: id-ID
X-API-Version: v1
```

#### Custom Headers
All custom headers prefixed with `X-`

### Request Body

#### JSON Format
```json
{
  "snake_case_field": "value",
  "nested_object": {
    "field": "value"
  },
  "array_field": [1, 2, 3]
}
```

**Conventions:**
- Use `snake_case` for field names
- Use consistent data types
- Include only necessary fields
- Validate on server-side

#### Content Types Supported
- `application/json` (primary)
- `multipart/form-data` (file uploads)
- `application/x-www-form-urlencoded` (OAuth)

---

## Response Format

### Success Response Structure

#### Single Resource
```json
{
  "success": true,
  "data": {
    "id": "client_123abc",
    "name": "PT Maju Jaya",
    "npwp": "01.234.567.8-901.000",
    "created_at": "2025-12-23T10:00:00Z",
    "updated_at": "2025-12-23T10:00:00Z"
  },
  "meta": {
    "timestamp": "2025-12-23T10:00:00Z",
    "request_id": "req_xyz789"
  }
}
```

#### Collection
```json
{
  "success": true,
  "data": [
    { "id": "1", "name": "Client 1" },
    { "id": "2", "name": "Client 2" }
  ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 42,
    "total_pages": 3,
    "has_next": true,
    "has_prev": false,
    "timestamp": "2025-12-23T10:00:00Z",
    "request_id": "req_xyz789"
  },
  "links": {
    "first": "/v1/clients?page=1",
    "prev": null,
    "next": "/v1/clients?page=2",
    "last": "/v1/clients?page=3"
  }
}
```

#### Empty Collection
```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 0,
    "total_pages": 0,
    "timestamp": "2025-12-23T10:00:00Z",
    "request_id": "req_xyz789"
  }
}
```

---

## Error Handling

### Error Response Structure
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": [
      {
        "field": "email",
        "code": "INVALID_FORMAT",
        "message": "Email format is invalid"
      }
    ],
    "documentation_url": "https://docs.ai-pajak.com/errors/ERROR_CODE"
  },
  "meta": {
    "timestamp": "2025-12-23T10:00:00Z",
    "request_id": "req_xyz789"
  }
}
```

### HTTP Status Codes

#### 2xx Success
```
200 OK                  - Successful GET, PUT, PATCH, DELETE
201 Created             - Successful POST (resource created)
202 Accepted            - Async operation accepted
204 No Content          - Successful DELETE (no body)
```

#### 3xx Redirection
```
301 Moved Permanently   - Permanent URL change
302 Found               - Temporary redirect
304 Not Modified        - Resource not modified (caching)
```

#### 4xx Client Errors
```
400 Bad Request         - Invalid request syntax
401 Unauthorized        - Missing or invalid authentication
403 Forbidden           - Authenticated but not authorized
404 Not Found           - Resource not found
405 Method Not Allowed  - HTTP method not supported
409 Conflict            - Resource state conflict
410 Gone                - Resource permanently removed
422 Unprocessable Entity - Validation errors
429 Too Many Requests   - Rate limit exceeded
```

#### 5xx Server Errors
```
500 Internal Server Error - Unexpected server error
502 Bad Gateway          - Upstream server error
503 Service Unavailable  - Server temporarily unavailable
504 Gateway Timeout      - Upstream server timeout
```

### Error Codes

#### Authentication & Authorization
```
INVALID_CREDENTIALS         - Invalid email or password
TOKEN_EXPIRED              - Access token expired
TOKEN_INVALID              - Access token invalid or malformed
INSUFFICIENT_PERMISSIONS   - User lacks required permissions
ACCOUNT_LOCKED             - Account temporarily locked
ACCOUNT_DISABLED           - Account permanently disabled
```

#### Validation
```
VALIDATION_ERROR           - General validation error
REQUIRED_FIELD_MISSING     - Required field not provided
INVALID_FORMAT             - Field format invalid
INVALID_VALUE              - Field value invalid
VALUE_OUT_OF_RANGE         - Numeric value out of range
INVALID_LENGTH             - String length invalid
DUPLICATE_ENTRY            - Resource already exists
```

#### Business Logic
```
RESOURCE_NOT_FOUND         - Requested resource doesn't exist
RESOURCE_CONFLICT          - Operation conflicts with current state
OPERATION_NOT_ALLOWED      - Operation not permitted
DEPENDENCY_NOT_MET         - Required dependency missing
QUOTA_EXCEEDED             - Usage quota exceeded
FILING_ALREADY_SUBMITTED   - Tax filing already submitted
DOCUMENT_PROCESSING_FAILED - Document processing error
```

#### System
```
INTERNAL_ERROR             - Unexpected server error
SERVICE_UNAVAILABLE        - Service temporarily down
RATE_LIMIT_EXCEEDED        - Too many requests
MAINTENANCE_MODE           - System under maintenance
DATABASE_ERROR             - Database operation failed
EXTERNAL_SERVICE_ERROR     - Third-party service error (DJP)
```

---

## Versioning

### Strategy
**URL-based versioning** (chosen for simplicity and visibility)

```
https://api.ai-pajak.com/v1/clients
https://api.ai-pajak.com/v2/clients
```

### Version Lifecycle
1. **Active** - Current production version
2. **Deprecated** - Old version, still supported
3. **Sunset** - Version being phased out (6 months notice)
4. **Retired** - No longer available

### Deprecation Headers
```http
Sunset: Sat, 01 Jun 2026 00:00:00 GMT
Deprecation: Sat, 01 Dec 2025 00:00:00 GMT
Link: <https://api.ai-pajak.com/v2/clients>; rel="successor-version"
```

### Breaking Changes
Require new major version:
- Removing endpoints or fields
- Changing field types
- Renaming fields or resources
- Changing authentication mechanism
- Changing error response format

### Non-Breaking Changes
Can be added to current version:
- Adding new endpoints
- Adding optional request parameters
- Adding response fields
- Adding new error codes
- Performance improvements

---

## Filtering

### Query Parameters
```
GET /v1/clients?status=active&business_type=PT
```

### Operators
| Operator | Syntax | Example |
|----------|--------|---------|
| Equals | `field=value` | `status=active` |
| Not equals | `field[ne]=value` | `status[ne]=inactive` |
| Greater than | `field[gt]=value` | `created_at[gt]=2025-01-01` |
| Greater or equal | `field[gte]=value` | `amount[gte]=1000000` |
| Less than | `field[lt]=value` | `amount[lt]=5000000` |
| Less or equal | `field[lte]=value` | `created_at[lte]=2025-12-31` |
| In list | `field[in]=v1,v2` | `status[in]=active,pending` |
| Not in list | `field[nin]=v1,v2` | `status[nin]=deleted,archived` |
| Like (contains) | `field[like]=value` | `name[like]=Maju` |
| Between | `field[between]=v1,v2` | `amount[between]=1000000,5000000` |

### Date Filters
```
created_at[gte]=2025-01-01T00:00:00Z
created_at[lt]=2025-12-31T23:59:59Z
```

**Supported formats:**
- ISO 8601: `2025-12-23T10:00:00Z`
- Date only: `2025-12-23`
- Relative: `today`, `yesterday`, `last_7_days`

---

## Sorting

### Syntax
```
GET /v1/clients?sort=name
GET /v1/clients?sort=-created_at
GET /v1/clients?sort=-created_at,name
```

### Conventions
- Default: ascending order
- Prefix `-` for descending
- Multiple fields: comma-separated
- Priority: left to right

### Examples
```
sort=name                    # Name A-Z
sort=-created_at             # Newest first
sort=-priority,created_at    # High priority first, then oldest
```

---

## Pagination

### Offset-Based (Default)
```
GET /v1/clients?page=2&per_page=20
```

**Parameters:**
- `page` - Page number (default: 1)
- `per_page` - Items per page (default: 20, max: 100)

**Response:**
```json
{
  "data": [...],
  "meta": {
    "page": 2,
    "per_page": 20,
    "total": 142,
    "total_pages": 8
  },
  "links": {
    "first": "/v1/clients?page=1&per_page=20",
    "prev": "/v1/clients?page=1&per_page=20",
    "next": "/v1/clients?page=3&per_page=20",
    "last": "/v1/clients?page=8&per_page=20"
  }
}
```

### Cursor-Based (For Large Datasets)
```
GET /v1/tax-filings?cursor=eyJpZCI6MTIzfQ&limit=20
```

**Parameters:**
- `cursor` - Opaque cursor token
- `limit` - Max items (default: 20, max: 100)

**Response:**
```json
{
  "data": [...],
  "meta": {
    "has_more": true,
    "next_cursor": "eyJpZCI6MTQzfQ"
  },
  "links": {
    "next": "/v1/tax-filings?cursor=eyJpZCI6MTQzfQ&limit=20"
  }
}
```

---

## Field Selection

### Sparse Fieldsets
Request only needed fields:

```
GET /v1/clients?fields=id,name,npwp
```

**Response:**
```json
{
  "data": [
    {
      "id": "client_123",
      "name": "PT Maju Jaya",
      "npwp": "01.234.567.8-901.000"
    }
  ]
}
```

### Expanding Relations
Include related resources:

```
GET /v1/tax-filings?expand=client,accountant
```

**Response:**
```json
{
  "data": {
    "id": "filing_123",
    "client": {
      "id": "client_456",
      "name": "PT Maju Jaya"
    },
    "accountant": {
      "id": "user_789",
      "name": "Siti Wijaya"
    }
  }
}
```

---

## Bulk Operations

### Bulk Create
```http
POST /v1/clients/bulk
Content-Type: application/json

{
  "clients": [
    { "name": "Client 1", "npwp": "..." },
    { "name": "Client 2", "npwp": "..." }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "created": 2,
    "failed": 0,
    "results": [
      { "id": "client_123", "status": "created" },
      { "id": "client_456", "status": "created" }
    ]
  }
}
```

### Bulk Update
```http
PATCH /v1/clients/bulk
Content-Type: application/json

{
  "updates": [
    { "id": "client_123", "status": "active" },
    { "id": "client_456", "status": "inactive" }
  ]
}
```

### Bulk Delete
```http
DELETE /v1/clients/bulk
Content-Type: application/json

{
  "ids": ["client_123", "client_456", "client_789"]
}
```

---

## Asynchronous Operations

### Long-Running Operations
For operations that take > 2 seconds:

**Request:**
```http
POST /v1/tax-filings/{id}/submit
```

**Response: 202 Accepted**
```json
{
  "success": true,
  "data": {
    "job_id": "job_abc123",
    "status": "processing",
    "created_at": "2025-12-23T10:00:00Z"
  },
  "links": {
    "status": "/v1/jobs/job_abc123"
  }
}
```

**Check Status:**
```http
GET /v1/jobs/job_abc123
```

**Response:**
```json
{
  "success": true,
  "data": {
    "job_id": "job_abc123",
    "status": "completed",
    "progress": 100,
    "result": {
      "submission_id": "djp_xyz789",
      "confirmation_number": "BPE-12345"
    },
    "created_at": "2025-12-23T10:00:00Z",
    "completed_at": "2025-12-23T10:02:30Z"
  }
}
```

**Job Statuses:**
- `queued` - Job in queue
- `processing` - Job running
- `completed` - Job finished successfully
- `failed` - Job failed
- `cancelled` - Job cancelled

---

## Caching

### Response Headers
```http
Cache-Control: max-age=3600, private
ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"
Last-Modified: Mon, 23 Dec 2025 10:00:00 GMT
Vary: Accept-Encoding, Authorization
```

### Conditional Requests

**With ETag:**
```http
GET /v1/clients/123
If-None-Match: "33a64df551425fcc55e4d42a148795d9f25f89d4"
```

**Response: 304 Not Modified** (if unchanged)

**With Last-Modified:**
```http
GET /v1/clients/123
If-Modified-Since: Mon, 23 Dec 2025 10:00:00 GMT
```

### Cache-Control Directives
```
public          - Cacheable by any cache
private         - Cacheable only by client
no-cache        - Revalidate before use
no-store        - Do not cache
max-age=3600    - Cache for 1 hour
must-revalidate - Revalidate when stale
```

---

## Rate Limiting

### Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1703329200
```

### 429 Response
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 3600
```

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Retry after 3600 seconds.",
    "retry_after": 3600
  }
}
```

---

## CORS

### Allowed Origins
```
Production: https://app.ai-pajak.com
Staging: https://staging.ai-pajak.com
Development: http://localhost:3000
```

### Response Headers
```http
Access-Control-Allow-Origin: https://app.ai-pajak.com
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 86400
```

### Preflight Request
```http
OPTIONS /v1/clients HTTP/1.1
Origin: https://app.ai-pajak.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: Content-Type, Authorization
```

---

## Security

### HTTPS Only
- All API traffic over HTTPS (TLS 1.3)
- HTTP requests redirected to HTTPS
- HSTS header: `Strict-Transport-Security: max-age=31536000`

### Input Validation
- Validate all inputs server-side
- Sanitize user input
- Escape output
- Use parameterized queries (SQL injection prevention)

### Authentication
- JWT tokens (see [Authentication](./authentication.md))
- Token expiration
- Refresh token rotation
- Revocation support

### CSRF Protection
- CSRF tokens for state-changing operations
- SameSite cookie attribute
- Origin validation

### Content Security
```http
Content-Security-Policy: default-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

---

## Documentation

### OpenAPI 3.1 Specification
All endpoints documented in OpenAPI format:
- Request/response schemas
- Example values
- Error codes
- Authentication requirements

### Inline Documentation
```json
{
  "name": {
    "type": "string",
    "description": "Company legal name",
    "example": "PT Maju Jaya",
    "minLength": 2,
    "maxLength": 100
  }
}
```

---

## Testing

### Test Environment
```
Base URL: https://sandbox-api.ai-pajak.com/v1
```

### Test Data
- Use test credentials
- Mock DJP integration
- No real data consequences
- Reset database daily

---

## Related Documentation
- [API Overview](./README.md)
- [Authentication](./authentication.md)
- [Tax Filing API](./endpoints/tax-filing-api.md)
- [Error Codes Reference](./error-codes.md)

---

**Document Version:** 1.0
**Last Updated:** 2025-12-23
**Maintained By:** API Team
