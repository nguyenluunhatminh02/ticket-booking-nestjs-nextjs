---
name: error-handling
description: Error handling patterns, exception management, retry logic with exponential backoff, circuit breakers, graceful degradation, error boundaries, custom error types, error logging strategies, and fault tolerance. Use when implementing error handling, designing resilient systems, handling failures gracefully, setting up retry mechanisms, or building fault-tolerant applications.
license: MIT
version: 1.0.0
trigger: When implementing error handling, designing resilient systems, handling failures gracefully, setting up retry mechanisms, or building fault-tolerant applications.
---

# Error Handling Skill

Build resilient systems with proper error handling, retry logic, circuit breakers, and graceful degradation patterns.

## When to Use

- Designing error handling strategies
- Implementing retry mechanisms
- Building circuit breakers
- Handling failures gracefully
- Creating custom error types
- Setting up error logging
- Designing fault-tolerant systems
- Implementing error boundaries

## Error Handling Principles

**Fail Fast:**
- Validate inputs early
- Throw errors immediately when invariants are violated
- Don't continue with invalid state

**Fail Gracefully:**
- Provide meaningful error messages
- Offer fallback options
- Maintain system stability
- Log errors for debugging

**Fail Safely:**
- Don't expose sensitive information
- Maintain data consistency
- Rollback transactions on failure
- Preserve user experience

## Custom Error Types

**JavaScript/TypeScript:**
```typescript
class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
  }
}

class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 'AUTH_ERROR', 401, false);
  }
}
```

**Python:**
```python
class AppError(Exception):
    def __init__(self, message, code, status_code=500):
        super().__init__(message)
        self.code = code
        self.status_code = status_code

class NotFoundError(AppError):
    def __init__(self, resource):
        super().__init__(f"{resource} not found", "NOT_FOUND", 404)

class ValidationError(AppError):
    def __init__(self, message):
        super().__init__(message, "VALIDATION_ERROR", 400)
```

## Retry Logic with Exponential Backoff

**Basic Implementation:**
```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      const delay = baseDelay * Math.pow(2, attempt);
      const jitter = delay * 0.1 * Math.random();
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
    }
  }
  throw new Error('Max retries exceeded');
}
```

**When to Retry:**
- Network timeouts
- Temporary service unavailability (503)
- Rate limiting (429)
- Database connection issues

**When NOT to Retry:**
- 4xx client errors (except 429)
- Validation errors
- Authentication failures
- Business logic errors

## Circuit Breaker Pattern

**Purpose:** Prevent cascading failures when downstream services are unhealthy.

**States:**
- **Closed:** Normal operation, requests pass through
- **Open:** Service unhealthy, requests fail immediately
- **Half-Open:** Testing if service recovered

**Implementation:**
```typescript
class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;

  constructor(
    private failureThreshold: number = 5,
    private resetTimeout: number = 60000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}
```

## Error Boundaries (React)

```typescript
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logErrorToService(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
```

## Graceful Degradation

**Strategies:**
- **Fallback content:** Show default data when API fails
- **Cached data:** Serve stale data when service unavailable
- **Reduced functionality:** Disable non-critical features
- **Queue requests:** Retry later when service recovers
- **Alternative paths:** Use different service/method

**Example:**
```typescript
async function getUserData(userId: string) {
  try {
    return await fetchFromAPI(userId);
  } catch (error) {
    // Try cache first
    const cached = await getFromCache(userId);
    if (cached) return cached;
    
    // Return minimal data
    return { id: userId, name: 'Unknown', degraded: true };
  }
}
```

## Error Logging Best Practices

**What to Log:**
- Error type and message
- Stack trace
- Context (user ID, request ID, timestamp)
- Environment (production, staging)
- Related data (without sensitive info)

**What NOT to Log:**
- Passwords, tokens, secrets
- Personal information (PII)
- Credit card numbers
- Session IDs

**Structured Logging:**
```typescript
logger.error({
  message: 'Database query failed',
  error: error.message,
  stack: error.stack,
  userId: user.id,
  query: sanitizedQuery,
  timestamp: new Date().toISOString(),
  environment: process.env.NODE_ENV
});
```

## Global Error Handlers

**Node.js:**
```typescript
process.on('uncaughtException', (error) => {
  logger.fatal('Uncaught exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
});
```

**Express:**
```typescript
app.use((err, req, res, next) => {
  logger.error(err);
  
  if (err.isOperational) {
    res.status(err.statusCode).json({
      error: err.code,
      message: err.message
    });
  } else {
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Something went wrong'
    });
  }
});
```

## Timeout Handling

```typescript
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Timeout')), timeoutMs);
  });
  
  return Promise.race([promise, timeout]);
}

// Usage
const data = await withTimeout(fetchData(), 5000);
```

## Bulkhead Pattern

Isolate failures by separating resources:
```typescript
// Separate connection pools for different services
const userPool = createPool({ max: 10 });
const orderPool = createPool({ max: 10 });
const analyticsPool = createPool({ max: 5 });
```

## Resources

- Circuit Breaker: https://martinfowler.com/bliki/CircuitBreaker.html
- Retry Pattern: https://docs.microsoft.com/en-us/azure/architecture/patterns/retry
- Error Handling in Node.js: https://nodejs.org/api/errors.html
- Resilience Patterns: https://docs.microsoft.com/en-us/azure/architecture/framework/resiliency/reliability-patterns
