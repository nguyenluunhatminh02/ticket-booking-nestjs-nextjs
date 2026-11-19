import { HttpException, HttpStatus } from '@nestjs/common';

export class AuthException extends HttpException {
  constructor(message: string, status: HttpStatus = HttpStatus.BAD_REQUEST) {
    super(message, status);
  }
}

export class BadCredentialsException extends AuthException {
  constructor(message = 'Invalid email or password') {
    super(message, HttpStatus.UNAUTHORIZED);
  }
}

export class ResourceNotFoundException extends AuthException {
  constructor(resource: string, identifier?: string) {
    super(
      identifier ? `${resource} not found with: ${identifier}` : `${resource} not found`,
      HttpStatus.NOT_FOUND,
    );
  }
}

export class ResourceAlreadyExistsException extends AuthException {
  constructor(resource: string, identifier?: string) {
    super(
      identifier ? `${resource} already exists: ${identifier}` : `${resource} already exists`,
      HttpStatus.CONFLICT,
    );
  }
}

export class InvalidTokenException extends AuthException {
  constructor(message = 'Invalid or expired token') {
    super(message, HttpStatus.UNAUTHORIZED);
  }
}

export class MfaException extends AuthException {
  constructor(message = 'MFA verification failed') {
    super(message, HttpStatus.UNAUTHORIZED);
  }
}

export class AccountLockedException extends AuthException {
  constructor(message = 'Account is locked') {
    super(message, HttpStatus.LOCKED);
  }
}

export class EmailNotVerifiedException extends AuthException {
  constructor(message = 'Email address not verified') {
    super(message, HttpStatus.FORBIDDEN);
  }
}

export class RateLimitExceededException extends AuthException {
  constructor(message = 'Rate limit exceeded. Please try again later.') {
    super(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}

export class DeviceLimitExceededException extends AuthException {
  constructor(message = 'Maximum device limit exceeded') {
    super(message, HttpStatus.FORBIDDEN);
  }
}

export class PasswordValidationException extends AuthException {
  violations: string[];
  constructor(violations: string[]) {
    super('Password does not meet requirements', HttpStatus.BAD_REQUEST);
    this.violations = violations;
  }
}
