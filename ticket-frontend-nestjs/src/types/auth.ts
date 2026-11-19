/* ===== API Response Types ===== */

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
}

/* ===== User ===== */

export interface UserInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username?: string;
  phoneNumber?: string;
  profilePicture?: string;
  roles: string[];
  emailVerified: boolean;
  mfaEnabled: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

/* ===== Auth ===== */

export interface AuthResponse {
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
  user: UserInfo;
  mfaRequired?: boolean;
  mfaToken?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  deviceId?: string;
  deviceName?: string;
  deviceType?: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phoneNumber?: string;
}

export interface MfaVerifyRequest {
  mfaToken: string;
  totpCode: string;
  deviceId?: string;
  deviceName?: string;
  deviceType?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  logoutAllDevices?: boolean;
}

export interface ResendVerificationRequest {
  email: string;
}

/* ===== MFA ===== */

export interface MfaSetupResponse {
  secret: string;
  qrCodeImage: string;
  manualEntryKey: string;
  backupCodes: string[];
}

export interface MfaSetupConfirmRequest {
  secret: string;
  totpCode: string;
}

export interface MfaStatusResponse {
  mfaEnabled: boolean;
  backupCodesRemaining?: number;
}

/* ===== Device ===== */

export interface DeviceResponse {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceType: string;
  browser: string;
  os: string;
  ipAddress: string;
  lastActiveAt: string;
  trusted: boolean;
  current: boolean;
  active: boolean;
}

export interface ActiveSessionsResponse {
  devices: DeviceResponse[];
  activeSessionCount: number;
  maxDevices: number;
}

export interface RenameDeviceRequest {
  deviceName: string;
}

/* ===== User Profile ===== */

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  username?: string;
}

export interface DeactivateAccountRequest {
  password: string;
  reason?: string;
}

/* ===== History ===== */

export interface LoginHistoryResponse {
  id: string;
  email: string;
  ipAddress: string;
  deviceInfo: string;
  success: boolean;
  failureReason?: string;
  attemptedAt: string;
}

export interface SecurityEventResponse {
  id: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress: string;
  details?: string;
  success: boolean;
  createdAt: string;
}

/* ===== Paginated ===== */

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

export interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username?: string;
  phoneNumber?: string;
  profilePicture?: string;
  roles: string[];
  emailVerified: boolean;
  mfaEnabled: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

/* ===== OAuth2 ===== */
export interface OAuth2Provider {
  name: string;
  displayName: string;
  authUrl: string;
  icon: string;
}

export interface ConnectedAccount {
  id: string;
  provider: string;
  email: string;
  name: string;
  imageUrl?: string;
  connectedAt: string;
}
