export class AuditLog {
  id: string;
  user: any;
  userId: string;
  action: string;
  resource: string;
  resourceType: string;
  resourceId: string;
  details: string;
  detailsJson: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  deviceId: string;
  success: boolean;
  createdAt: Date;
}
