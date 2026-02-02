# Local Supabase Implementation - Summary

> **📦 ARCHIVED**: This document was moved to archive on 2026-02-02.
> The JWT verification strategy described here is now implemented in `backend/services/auth/`.
> For current setup instructions, see [docs/setup/LOCAL_DEVELOPMENT.md](../setup/LOCAL_DEVELOPMENT.md).

## Overview

This document summarizes the implementation of **local Supabase support** for the Lock-in backend, following **industry best practices** for scalability, reliability, maintainability, testability, and SOLID principles.

## Problem Statement

The original error indicated that the backend was attempting to validate JWT tokens using the wrong verification method:

```
Supabase token validation failed: invalid JWT: unable to parse or verify signature,
token signature is invalid: signing method ES256 is invalid
```

**Root Cause**: Supabase CLI v1.x+ switched from HS256 (symmetric HMAC) to ES256 (asymmetric ECDSA) for JWT signing. The previous implementation tried to verify ES256-signed tokens using an HS256 secret, which is fundamentally incompatible.

## Solution Architecture

### Strategy Pattern for JWT Verification

```
┌─────────────────────────────────────────────────────────────┐
│               JwtVerificationService                         │
│         (Orchestrates verification strategies)               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ JwksVerifier    │  │ SymmetricVerifier│  │ SupabaseSdk │ │
│  │ Strategy        │  │ Strategy         │  │ Strategy    │ │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────┤ │
│  │ ES256, RS256    │  │ HS256, HS384    │  │ SDK getUser │ │
│  │ (Asymmetric)    │  │ (Symmetric)      │  │ (Cloud)     │ │
│  │ Uses JWKS       │  │ Uses JWT Secret │  │             │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
│           ↓                    ↓                    ↓        │
│      Try First            Try Second           Try Third     │
│     (Local ES256)      (Legacy HS256)         (Fallback)     │
└─────────────────────────────────────────────────────────────┘
```

### Environment-Based Strategy Selection

```
┌─────────────────────────────────────────────────────────────┐
│                 ENVIRONMENT ISOLATION                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Development (Local)        Staging              Production │
│  ───────────────────        ───────              ────────── │
│  • Local Supabase           • Cloud Supabase     • Cloud    │
│  • 127.0.0.1:54321          • Dev project        • Prod     │
│  • JWKS (ES256) primary     • SDK primary        • SDK      │
│  • HS256 fallback           • JWKS fallback      • JWKS     │
│  • Isolated per developer   • Shared team env    • Prod DB  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **JWKS-Based Verification (ES256)**
   - Fetches public keys from `/auth/v1/.well-known/jwks.json`
   - Supports key rotation automatically
   - Caches keys for 10 minutes (matches Supabase Edge cache)

2. **Strategy Pattern with Fallback**
   - Multiple verification methods in priority order
   - Graceful degradation if one strategy fails
   - No code changes needed to add new strategies

3. **Singleton Lazy Initialization**
   - JWT verifier created once on first request
   - JWKS cache shared across all requests
   - Prevents thundering herd on startup

## Implementation Details

### New Files Created

#### 1. **backend/services/auth/jwtVerificationService.js**

Orchestrates JWT verification using the Strategy Pattern.

```javascript
class JwtVerificationService {
  constructor({ strategies = [], failFast = false }) {
    this._strategies = strategies;
    this._failFast = failFast;
  }

  async verify(token) {
    for (const strategy of this._strategies) {
      if (strategy.isAvailable && !strategy.isAvailable()) continue;

      const result = await strategy.verify(token);
      if (result.valid) {
        return { ...result, strategy: strategy.name };
      }
    }
    return { valid: false, error: 'All strategies failed' };
  }
}
```

#### 2. **backend/services/auth/jwksProvider.js**

Fetches and caches JWKS (JSON Web Key Sets) from Supabase.

```javascript
class JwksProvider {
  constructor({ jwksUri, cacheTtlMs = 600000 }) {
    this._jwksUri = jwksUri;
    this._cache = null;
    this._cacheExpiry = 0;
  }

  async getKeys(forceRefresh = false) {
    if (!forceRefresh && this._cache && Date.now() < this._cacheExpiry) {
      return this._cache; // Return cached keys
    }
    // Fetch fresh keys from JWKS endpoint
    const jwks = await fetch(this._jwksUri).then((r) => r.json());
    this._cache = jwks;
    this._cacheExpiry = Date.now() + this._cacheTtlMs;
    return jwks;
  }
}
```

#### 3. **backend/services/auth/strategies.js**

Pluggable verification strategies.

- **JwksVerifierStrategy**: Verifies ES256/RS256 tokens using JWKS
- **SymmetricVerifierStrategy**: Verifies HS256 tokens using shared secret
- **SupabaseSdkVerifierStrategy**: Delegates to Supabase SDK

#### 4. **backend/services/auth/jwtVerifierFactory.js**

Creates properly configured verifier based on environment.

```javascript
function createJwtVerifierForConfig({ config, supabaseClient }) {
  const strategies = [];

  if (config.SUPABASE_IS_LOCAL) {
    // Local: JWKS first (ES256), then symmetric (HS256)
    strategies.push(new JwksVerifierStrategy({ jwksProvider }));
    strategies.push(new SymmetricVerifierStrategy({ secret: config.SUPABASE_JWT_SECRET }));
  } else {
    // Cloud: SDK first, then JWKS, then symmetric
    strategies.push(new SupabaseSdkVerifierStrategy({ supabaseClient }));
    strategies.push(new JwksVerifierStrategy({ jwksProvider }));
  }

  return new JwtVerificationService({ strategies });
}
```

### Modified Files

#### **backend/middleware/authMiddleware.js**

Refactored to use the new JWT verification service.

```javascript
const { createJwtVerifierForConfig } = require('../services/auth');

let _jwtVerifier = null;

function getJwtVerifier() {
  if (!_jwtVerifier) {
    _jwtVerifier = createJwtVerifierForConfig({ config, supabaseClient: supabase });
  }
  return _jwtVerifier;
}

async function requireSupabaseUser(req, res, next) {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const verifier = getJwtVerifier();
  const result = await verifier.verify(token);

  if (!result.valid) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = result.payload;
  next();
}
```

## SOLID Principles Implementation

### Single Responsibility Principle (SRP) ✅

Each module has ONE clear responsibility:

| Module                          | Responsibility                            |
| ------------------------------- | ----------------------------------------- |
| **JwtVerificationService**      | Orchestrate verification strategies       |
| **JwksProvider**                | Fetch and cache JWKS                      |
| **JwksVerifierStrategy**        | Verify ES256/RS256 tokens                 |
| **SymmetricVerifierStrategy**   | Verify HS256 tokens                       |
| **SupabaseSdkVerifierStrategy** | Delegate to Supabase SDK                  |
| **jwtVerifierFactory**          | Create configured verifier                |
| **authMiddleware**              | Extract token, call verifier, attach user |

### Open/Closed Principle (OCP) ✅

**Extensible without modification:**

```javascript
// Adding a new auth method (e.g., API keys) is just a new strategy
class ApiKeyVerifierStrategy {
  name = 'api-key';
  isAvailable() {
    return Boolean(config.API_KEYS_ENABLED);
  }
  async verify(token) {
    /* ... */
  }
}

// Add to factory - no changes to existing strategies
strategies.push(new ApiKeyVerifierStrategy());
```

### Liskov Substitution Principle (LSP) ✅

**All strategies are interchangeable:**

```typescript
interface JwtVerifierStrategy {
  name: string;
  isAvailable?(): boolean;
  verify(token: string): Promise<VerificationResult>;
}
```

All three strategies implement this interface and can replace each other.

### Interface Segregation Principle (ISP) ✅

**Minimal interface for strategies:**

- Only `name` and `verify()` are required
- `isAvailable()` is optional
- Strategies don't need to know about each other

### Dependency Inversion Principle (DIP) ✅

**Depend on abstractions:**

```javascript
// JwtVerificationService depends on strategy interface, not implementations
constructor({ strategies }) {
  this._strategies = strategies;  // Any strategy works
}

// JwksVerifierStrategy depends on JwksProvider interface
constructor({ jwksProvider }) {
  this._jwksProvider = jwksProvider;  // Any provider works (enables mocking)
}
```

## Testing Strategy

### Unit Tests Created

| Test File                        | Coverage                                |
| -------------------------------- | --------------------------------------- |
| `jwtVerificationService.test.js` | Orchestration, fallback, error handling |
| `jwksProvider.test.js`           | Caching, refresh, error recovery        |
| `strategies.test.js`             | Each strategy in isolation              |

### Mock Injection

All external dependencies are injectable for testing:

```javascript
// Real usage
const provider = new JwksProvider({ jwksUri: 'https://...' });

// Test usage
const mockFetcher = async () => ({ keys: [testKey] });
const provider = new JwksProvider({ jwksUri: '...', fetcher: mockFetcher });
```

## Migration Guide

### From Old Implementation

If upgrading from the previous HS256-only implementation:

1. **Update backend/.env.local**:

   ```bash
   # Get fresh keys from Supabase CLI
   npx supabase status -o env | grep -E "ANON_KEY|SERVICE_ROLE_KEY"

   # Paste the ES256 tokens (they start with "eyJhbGciOiJFUzI1NiI...")
   SUPABASE_SERVICE_ROLE_KEY_DEV=<paste>
   SUPABASE_ANON_KEY_DEV=<paste>
   ```

2. **Restart backend**:
   ```bash
   npm run dev
   ```

The new implementation automatically detects ES256 tokens and uses JWKS verification.

### No Code Changes Required

The refactored middleware maintains the same interface:

- Still exports `requireSupabaseUser`
- Still attaches user to `req.user`
- Existing route handlers work unchanged
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = require('../config');

// Auth middleware needs additional details
const { SUPABASE_JWT_SECRET, SUPABASE_IS_LOCAL } = require('../config');

````

### Dependency Inversion Principle (DIP) ✅

**Depends on abstractions, not concretions:**
```javascript
// ❌ BAD: Hard-coded environment variable access
const jwtSecret = process.env.SUPABASE_JWT_SECRET;

// ✅ GOOD: Depends on config abstraction
const { SUPABASE_JWT_SECRET } = require('../config');
````

**Testability benefit:**

```javascript
// Can mock config in tests without changing middleware
jest.mock('../config', () => ({
  SUPABASE_IS_LOCAL: true,
  SUPABASE_JWT_SECRET: 'test-secret',
}));
```

## Scalability Considerations

### Current: Single Developer (Local Development)

**Characteristics:**

- ✅ No network latency (localhost connections)
- ✅ No cross-developer conflicts (isolated databases)
- ✅ Fast iteration (instant feedback)
- ✅ Offline capability (no cloud dependency)

### Future: Team Development (Staging)

**Recommended enhancements:**

- Connection pooling via Supavisor (Supabase's PgBouncer)
- Rate limiting per developer (already implemented)
- Shared seed data for consistent testing

### Future: Production (Multi-Region)

**Scalability plan:**

- **Database**: Read replicas in multiple regions
- **Connection pooling**: Required (max connections limit)
- **Caching**: Redis for frequently accessed data
- **CDN**: CloudFlare for static assets
- **Load balancing**: Azure Application Gateway

**Already implemented for scale:**

- ✅ Health check endpoint (`/health`)
- ✅ Centralized error handling
- ✅ Retry logic for transient failures
- ✅ Request rate limiting
- ✅ JWT validation with fallback
- ✅ Environment-aware configuration

## Reliability Features

### Fault Tolerance

**Already implemented:**

- ✅ **Retry logic**: Exponential backoff for transient errors
- ✅ **Graceful degradation**: AI provider fallbacks (Gemini → Groq → OpenAI)
- ✅ **Error handling**: Centralized middleware with structured logging
- ✅ **Health checks**: Docker healthcheck + `/health` endpoint

**Future enhancements:**

- 🔄 Circuit breakers for external services (Hystrix pattern)
- 🔄 Bulkhead isolation (separate thread pools per service)
- 🔄 Request timeouts (prevent hanging connections)

### Observability

**Already implemented:**

- ✅ **Structured logging**: JSON logs with context (user ID, request ID)
- ✅ **Error tracking**: Sentry integration (optional)
- ✅ **Health monitoring**: Azure Application Insights

**Future enhancements:**

- 🔄 Distributed tracing (OpenTelemetry)
- 🔄 Metrics dashboard (Prometheus + Grafana)
- 🔄 Alerting (PagerDuty integration)

## Maintainability Practices

### Clean Architecture

**Layered structure:**

```
Routes → Controllers → Services → Repositories → Database
   ↓          ↓            ↓            ↓            ↓
  HTTP      HTTP       Business     Data access    DB/APIs
  routing   handling    logic       abstraction
```

**Rule:** Controllers NEVER contain business logic (delegated to services).

### Documentation Strategy

**Stable Contracts (AGENTS files):**

- Project-wide rules (`/AGENTS.md`)
- Layer-specific rules (`/backend/AGENTS.md`)
- Update when architectural boundaries change

**Living Snapshots (Reference docs):**

- Implementation details (`docs/reference/CODE_OVERVIEW.md`)
- Database schema (`docs/reference/DATABASE.md`)
- Update when implementation changes

### Code Quality

**Enforced standards:**

- ✅ ESLint for code quality
- ✅ Prettier for formatting
- ✅ Zod for runtime validation
- ✅ Controller size limits (200 lines guideline)
- ✅ Service size limits (300 lines guideline)

## Testability Improvements

### Dependency Injection Pattern

**Before (hard to test):**

```javascript
// Direct access to environment variables
const jwtSecret = process.env.SUPABASE_JWT_SECRET;
jwt.verify(token, jwtSecret);
```

**After (easy to mock):**

```javascript
// Depends on config abstraction
const { SUPABASE_JWT_SECRET } = require('../config');
jwt.verify(token, SUPABASE_JWT_SECRET);

// Test can mock config:
jest.mock('../config', () => ({ SUPABASE_JWT_SECRET: 'test-secret' }));
```

### Separation of Concerns

**Pure functions preferred:**

```javascript
// ❌ BAD: Side effects make testing hard
function validateToken(req) {
  const token = req.headers.authorization; // Side effect: accessing req
  return jwt.verify(token, process.env.SECRET); // Side effect: env var
}

// ✅ GOOD: Pure function, easy to test
function validateToken(token, secret) {
  return jwt.verify(token, secret);
}
```

### Test Strategy

**Unit tests** (most tests here):

- Pure functions (`/core/utils`)
- Services with mocked dependencies
- Validation logic

**Integration tests**:

- Controllers with mocked services
- API endpoints with mocked DB
- Auth middleware with test JWT

**E2E tests** (manual for now):

- Full request → response flow
- Real database operations
- User acceptance testing

## Security Considerations

### Environment-Specific Secrets

**Local Supabase:**

- ✅ Standard demo JWT secret (safe to commit in `.env.local.example`)
- ✅ Only accessible from localhost
- ✅ No production data exposure

**Cloud Supabase:**

- ✅ Secrets stored in `.env` (gitignored)
- ✅ Production secrets in Azure Key Vault
- ✅ Service role keys never committed

### JWT Validation

**Local Supabase:**

- Symmetric signing (HS256) or asymmetric (ES256)
- Validates signature, expiration, issuer
- Prevents token tampering

**Cloud Supabase:**

- SDK handles key rotation automatically
- Asymmetric signing with regular key rotation
- Additional security layers (RLS policies)

## Migration Guide for Existing Developers

### Step 1: Update Code

```powershell
git pull origin main
cd backend
npm install  # Installs jsonwebtoken dependency
```

### Step 2: Setup Local Supabase

```powershell
# Automated
.\scripts\dev\setup-local.ps1

# Manual
npx supabase start
cp backend/.env.local.example backend/.env.local
npx supabase db reset
```

### Step 3: Verify

```powershell
cd backend
npm run dev
# In another terminal:
curl http://localhost:3000/health
```

**Expected response:**

```json
{
  "status": "healthy",
  "database": "connected",
  "uptime": 5.2
}
```

## Known Issues & Future Improvements

### Known Issues

1. **Transcript job reaper fails on startup** (non-blocking)
   - **Cause**: Background services try to use service role key for auth
   - **Impact**: Minimal - jobs still process correctly
   - **Fix**: Update job reaper to use manual JWT signing for local Supabase

### Future Improvements

1. **Connection Pooling**
   - Implement Supavisor for connection pooling
   - Required for production scale (>100 concurrent connections)

2. **Distributed Caching**
   - Add Redis for frequently accessed data (user profiles, settings)
   - Reduces database load by 60-80%

3. **Multi-Region Deployment**
   - Deploy backend to multiple Azure regions
   - Use read replicas for geographically distributed users

4. **Advanced Monitoring**
   - OpenTelemetry for distributed tracing
   - Prometheus metrics for real-time monitoring
   - Custom dashboards in Grafana

## Conclusion

This implementation follows **industry best practices** for:

✅ **Scalability**: Environment-based configuration supports local → staging → production progression  
✅ **Reliability**: Automatic failover between JWT validation methods, retry logic, health checks  
✅ **Maintainability**: Clean architecture with SOLID principles, comprehensive documentation  
✅ **Testability**: Dependency injection, pure functions, mockable abstractions  
✅ **Security**: Environment-specific secrets, proper JWT validation, no credentials in code

The solution is **production-ready** and can scale from single developer (local Supabase) to multi-region deployment (cloud Supabase with read replicas) without architectural changes.

---

**Next Steps:**

1. Review [Local Development Guide](../docs/setup/LOCAL_DEVELOPMENT.md) for daily workflow
2. Read [Backend AGENTS](../backend/AGENTS.md) for coding standards
3. Check [Database Schema](../docs/reference/DATABASE.md) for data model
4. Follow [Contributing Guide](../CONTRIBUTING_AI.md) for PR process

**Questions?** Open an issue or check [Troubleshooting Guide](../docs/setup/TROUBLESHOOTING.md)
