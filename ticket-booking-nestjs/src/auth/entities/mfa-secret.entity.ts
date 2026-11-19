export class MfaSecret {
  id: string;
  user: any;
  userId: string;
  secretEncrypted: string;
  enabled: boolean;
  backupCodes: string;
  verified: boolean;
  verifiedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
