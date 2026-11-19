---
name: security-review
description: Comprehensive security review framework for code analysis, vulnerability detection, OWASP compliance, authentication/authorization checks, input validation, and secure coding practices. Use when reviewing code for security issues, implementing authentication, handling sensitive data, or before deploying to production.
license: MIT
version: 1.0.0
trigger: When reviewing code for security vulnerabilities, implementing authentication/authorization, handling sensitive data, processing user input, or before production deployment.
---

# Security Review

Comprehensive security review framework ensuring code meets security standards, identifies vulnerabilities, and follows secure coding practices.

## Core Principle

**Security is not optional.** Every line of code that handles user input, authentication, sensitive data, or external systems must be reviewed for security implications.

## When to Use

**Always use for:**
- Code handling authentication/authorization
- Processing user input
- Handling sensitive data (passwords, tokens, PII)
- Database operations
- API endpoints
- File system operations
- External service integrations
- Before production deployment

**Especially when:**
- New authentication flows
- Payment processing
- User-generated content
- File uploads/downloads
- Third-party integrations

## Security Review Checklist

### 1. Authentication & Authorization

**Authentication:**
- [ ] Password hashing (bcrypt, argon2 - never MD5/SHA)
- [ ] JWT properly signed and validated
- [ ] Session management secure
- [ ] Multi-factor authentication where appropriate
- [ ] Password reset flow secure
- [ ] Account lockout after failed attempts

**Authorization:**
- [ ] Role-based access control (RBAC) implemented
- [ ] Principle of least privilege followed
- [ ] API endpoints check permissions
- [ ] Resource-level authorization (not just route-level)
- [ ] No privilege escalation vulnerabilities

**Code Example:**
```typescript
// Secure password hashing
import bcrypt from 'bcrypt';

const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
};

const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};
```

### 2. Input Validation

**Validation Layers:**
- [ ] Client-side validation (UX, not security)
- [ ] Server-side validation (required)
- [ ] Database constraints (final defense)
- [ ] Schema validation (Zod, Joi, Yup)
- [ ] Type checking (TypeScript)

**Common Vulnerabilities:**
- SQL Injection: Use parameterized queries
- XSS: Sanitize output, use CSP headers
- Command Injection: Never use `eval()`, validate inputs
- Path Traversal: Validate file paths, use allowlists
- CSRF: Use CSRF tokens, validate origin

**Code Example:**
```typescript
import { z } from 'zod';

const UserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  age: z.number().int().min(13).max(120)
});

const validateUser = (data: unknown) => {
  return UserSchema.parse(data);
};
```

### 3. Sensitive Data Handling

**Data at Rest:**
- [ ] Encrypt sensitive database fields
- [ ] Use environment variables for secrets
- [ ] Never log sensitive data
- [ ] Secure file permissions
- [ ] Encrypted backups

**Data in Transit:**
- [ ] HTTPS only (TLS 1.2+)
- [ ] Certificate validation
- [ ] Secure WebSocket (WSS)
- [ ] API key rotation
- [ ] Token expiration

**What NOT to Log:**
```typescript
// BAD - Never log sensitive data
logger.info(`User login: ${email}, password: ${password}`);

// GOOD - Log without sensitive data
logger.info(`User login attempt`, { email, timestamp: Date.now() });
```

### 4. Database Security

**SQL Injection Prevention:**
```typescript
// BAD - Vulnerable to SQL injection
const query = `SELECT * FROM users WHERE email = '${email}'`;

// GOOD - Parameterized query
const query = 'SELECT * FROM users WHERE email = $1';
const result = await db.query(query, [email]);
```

**Database Best Practices:**
- [ ] Use ORM or query builder
- [ ] Parameterized queries only
- [ ] Limited database user permissions
- [ ] Connection pooling with limits
- [ ] Regular security audits
- [ ] Backup encryption

### 5. API Security

**Rate Limiting:**
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', limiter);
```

**API Security Checklist:**
- [ ] Authentication on all endpoints
- [ ] Rate limiting
- [ ] Request size limits
- [ ] CORS properly configured
- [ ] API versioning
- [ ] Error messages don't leak info
- [ ] HTTPS enforced
- [ ] API keys rotated regularly

### 6. File Upload Security

**Validation:**
```typescript
import multer from 'multer';
import path from 'path';

const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});
```

**File Upload Checklist:**
- [ ] File type validation (MIME type)
- [ ] File size limits
- [ ] Store outside webroot
- [ ] Rename files (prevent path traversal)
- [ ] Scan for malware
- [ ] Use CDN for serving

### 7. Dependencies Security

**Regular Audits:**
```bash
# npm audit
npm audit

# Fix vulnerabilities
npm audit fix

# Check for outdated packages
npm outdated
```

**Dependency Checklist:**
- [ ] Regular `npm audit` runs
- [ ] Lock files committed (package-lock.json)
- [ ] Review new dependencies before adding
- [ ] Use trusted sources only
- [ ] Keep dependencies updated
- [ ] Monitor security advisories

### 8. Security Headers

**Express Security Headers:**
```typescript
import helmet from 'helmet';

app.use(helmet());

// Or configure individually
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "https:"],
  }
}));

app.use(helmet.hsts({
  maxAge: 31536000,
  includeSubDomains: true
}));
```

**Required Headers:**
- [ ] Content-Security-Policy (CSP)
- [ ] X-Frame-Options (DENY or SAMEORIGIN)
- [ ] X-Content-Type-Options (nosniff)
- [ ] Strict-Transport-Security (HSTS)
- [ ] X-XSS-Protection
- [ ] Referrer-Policy

### 9. Error Handling Security

**Secure Error Messages:**
```typescript
// BAD - Leaks information
app.use((err, req, res, next) => {
  res.status(500).json({
    error: err.message,
    stack: err.stack,
    query: req.query
  });
});

// GOOD - Generic error messages
app.use((err, req, res, next) => {
  logger.error('Internal error', { error: err.message, stack: err.stack });
  
  if (err.isOperational) {
    res.status(err.statusCode).json({
      error: err.code,
      message: err.message
    });
  } else {
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    });
  }
});
```

### 10. OWASP Top 10 Compliance

**Check for:**
1. **Injection** - SQL, NoSQL, OS, LDAP
2. **Broken Authentication** - Weak passwords, session management
3. **Sensitive Data Exposure** - Unencrypted data, weak crypto
4. **XML External Entities (XXE)** - XML parsing vulnerabilities
5. **Broken Access Control** - Missing authorization checks
6. **Security Misconfiguration** - Default configs, verbose errors
7. **Cross-Site Scripting (XSS)** - Unsanitized output
8. **Insecure Deserialization** - Untrusted data deserialization
9. **Using Components with Known Vulnerabilities** - Outdated dependencies
10. **Insufficient Logging & Monitoring** - Missing audit trails

## Security Review Process

### Pre-Commit Review
1. Run automated security linters
2. Check for hardcoded secrets
3. Validate input handling
4. Review authentication logic

### Pre-Deployment Review
1. Full OWASP Top 10 checklist
2. Dependency audit
3. Penetration testing (if critical)
4. Security header validation
5. SSL/TLS configuration check

### Ongoing Monitoring
1. Regular dependency updates
2. Security advisory monitoring
3. Log review for suspicious activity
4. Periodic security audits

## Tools & Resources

**Automated Tools:**
- ESLint security plugins
- npm audit / yarn audit
- Snyk for dependency scanning
- OWASP ZAP for penetration testing
- SonarQube for code quality

**References:**
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- OWASP Cheat Sheet Series: https://cheatsheetseries.owasp.org/
- Node.js Security Checklist: https://blog.risingstack.com/node-js-security-checklist/
- Express Security Best Practices: https://expressjs.com/en/advanced/best-practice-security.html

## Red Flags - STOP Immediately

Stop and review if you see:
- Hardcoded passwords or API keys
- `eval()` or dynamic code execution
- SQL queries with string concatenation
- Missing authentication on endpoints
- Logging sensitive data
- Disabled security features "for testing"
- TODO comments about security fixes

**All mean:** Security review required before proceeding.
