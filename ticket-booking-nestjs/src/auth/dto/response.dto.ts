export class AuthResponseDto {
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
  user?: UserInfoDto;
  mfaRequired?: boolean;
  mfaToken?: string;

  static of(
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
    user: UserInfoDto,
  ): AuthResponseDto {
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn,
      user,
      mfaRequired: false,
    };
  }

  static mfaRequired(mfaToken: string): AuthResponseDto {
    return {
      mfaRequired: true,
      mfaToken,
    };
  }
}

export class UserInfoDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
  roles: string[];
  mfaEnabled: boolean;
}

export class UserResponseDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  profilePicture?: string;
  enabled: boolean;
  emailVerified: boolean;
  mfaEnabled: boolean;
  roles: string[];
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;

  static from(user: any): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      profilePicture: user.profilePicture,
      enabled: user.enabled,
      emailVerified: user.emailVerified,
      mfaEnabled: user.mfaEnabled,
      roles: user.roles?.map((r: any) => r.name || r) || [],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
    };
  }
}

export class ApiResponseDto<T = any> {
  success: boolean;
  message?: string;
  data?: T;

  static success<T>(data?: T, message?: string): ApiResponseDto<T> {
    return { success: true, message, data: data ?? undefined };
  }

  static error(message: string): ApiResponseDto {
    return { success: false, message };
  }
}

export class DeviceResponseDto {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceType: string;
  browser: string;
  operatingSystem: string;
  ipAddress: string;
  location: string;
  active: boolean;
  trusted: boolean;
  current: boolean;
  lastActiveAt: Date;
  createdAt: Date;
}

export class MfaSetupResponseDto {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export class ActiveSessionsResponseDto {
  totalSessions: number;
  maxSessions: number;
  devices: DeviceResponseDto[];
}
