export class OAuthAccount {
  id: string;
  user: any;
  userId: string;
  provider: string; // google, github, microsoft
  providerUserId: string;
  email: string;
  name: string;
  imageUrl: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
