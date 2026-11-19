export enum TokenType {
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
}

export class VerificationToken {
  id: string;
  tokenHash: string;
  type: string;
  user: any;
  userId: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;

  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }
}
