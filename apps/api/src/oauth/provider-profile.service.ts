import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';

@Injectable()
export class ProviderProfileService {
  async applicationIdentity(provider: string, accessToken: string) {
    if (provider === 'github') return this.github(accessToken);
    if (provider === 'google') return this.google(accessToken);
    throw new BadRequestException('Unsupported application identity provider');
  }

  async reddit(accessToken: string) {
    const response = await fetch('https://oauth.reddit.com/api/v1/me', { headers: { authorization: `Bearer ${accessToken}`, 'user-agent': process.env.REDDIT_USER_AGENT ?? 'web:leadsignal:1.0' }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new ServiceUnavailableException('Reddit identity lookup failed');
    const profile = await response.json() as { id: string; name: string };
    return { id: profile.id, username: profile.name };
  }

  private async github(accessToken: string) {
    const headers = { authorization: `Bearer ${accessToken}`, accept: 'application/vnd.github+json', 'user-agent': 'LeadSignal' };
    const response = await fetch('https://api.github.com/user', { headers, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new ServiceUnavailableException('GitHub identity lookup failed');
    const profile = await response.json() as { login: string; name?: string; email?: string };
    let email = profile.email;
    if (!email) {
      const emailsResponse = await fetch('https://api.github.com/user/emails', { headers, signal: AbortSignal.timeout(20_000) });
      const emails = emailsResponse.ok ? await emailsResponse.json() as Array<{ email: string; primary: boolean; verified: boolean }> : [];
      email = emails.find((item) => item.primary && item.verified)?.email ?? emails.find((item) => item.verified)?.email;
    }
    if (!email) throw new BadRequestException('GitHub account has no verified email');
    return { email: email.toLowerCase(), name: profile.name || profile.login };
  }

  private async google(accessToken: string) {
    const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new ServiceUnavailableException('Google identity lookup failed');
    const profile = await response.json() as { email?: string; email_verified?: boolean; name?: string };
    if (!profile.email || !profile.email_verified) throw new BadRequestException('Google account has no verified email');
    return { email: profile.email.toLowerCase(), name: profile.name || profile.email.split('@')[0] };
  }
}
