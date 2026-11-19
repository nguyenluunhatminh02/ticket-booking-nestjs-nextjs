import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(private configService: ConfigService) {
    const clientID = configService.get<string>('GITHUB_CLIENT_ID', '') || 'not-configured';
    const clientSecret = configService.get<string>('GITHUB_CLIENT_SECRET', '') || 'not-configured';
    const callbackURL = configService.get<string>('GITHUB_CALLBACK_URL', '') || 'http://localhost/callback';
    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['user:email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: any,
  ): Promise<void> {
    const emails = profile.emails || [];
    const user = {
      provider: 'github',
      providerId: profile.id,
      email: emails[0]?.value || `${profile.username}@github.com`,
      firstName: profile.displayName?.split(' ')[0] || profile.username,
      lastName: profile.displayName?.split(' ').slice(1).join(' ') || '',
      picture: profile.photos?.[0]?.value,
      accessToken,
      refreshToken,
    };
    done(null, user);
  }
}
