export class User {
  id: string;
  email: string;
  passwordHash: string;
  username: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  profilePicture: string;
  enabled: boolean;
  emailVerified: boolean;
  accountLocked: boolean;
  mfaEnabled: boolean;
  lockedUntil: Date;
  lastLoginAt: Date;
  emailVerifiedAt: Date;
  passwordChangedAt: Date;
  maxDevices: number;
  roles: any[];
  devices: any[];
  oauthAccounts: any[];
  passwordHistory: any[];
  mfaSecret: any;
  createdAt: Date;
  updatedAt: Date;

  isAccountNonLocked(): boolean {
    if (!this.accountLocked) return true;
    if (this.lockedUntil && new Date() > this.lockedUntil) {
      return true;
    }
    return false;
  }

  lockAccount(lockUntil: Date): void {
    this.accountLocked = true;
    this.lockedUntil = lockUntil;
  }

  unlockAccount(): void {
    this.accountLocked = false;
    this.lockedUntil = null as any;
  }

  updateLastLogin(): void {
    this.lastLoginAt = new Date();
  }
}
