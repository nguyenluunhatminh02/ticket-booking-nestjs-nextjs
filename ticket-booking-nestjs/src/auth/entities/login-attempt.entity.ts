export class LoginAttempt {
  id: string;
  user: any;
  userId: string;
  email: string;
  ipAddress: string;
  deviceInfo: string;
  success: boolean;
  failureReason: string;
  attemptedAt: Date;
  createdAt: Date;
}
