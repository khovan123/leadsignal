import { BadRequestException, Injectable } from '@nestjs/common';
import { CodeChallengeMethod, OAuth2Client } from 'arctic';
import { SecretsService } from '../secrets/secrets.service';

export type OAuthProviderConfig = {
  clientId: string;
  clientPassword?: string;
  redirectUri: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  scopes: string[];
  authorizationParams?: Record<string, string>;
};

@Injectable()
export class OAuthBrokerService {
  constructor(private readonly secrets: SecretsService) {}

  config(provider: string): OAuthProviderConfig {
    const raw = this.secrets.require('OAUTH_PROVIDERS');
    const configs = JSON.parse(raw) as Record<string, OAuthProviderConfig>;
    const config = configs[provider];
    if (!config) throw new BadRequestException(`OAuth provider ${provider} is not configured`);
    return config;
  }

  authorizationUrl(provider: string, state: string, verifier: string): URL {
    const config = this.config(provider);
    const client = new OAuth2Client(config.clientId, config.clientPassword ?? null, config.redirectUri);
    const url = client.createAuthorizationURLWithPKCE(config.authorizationEndpoint, state, CodeChallengeMethod.S256, verifier, config.scopes);
    for (const [key, value] of Object.entries(config.authorizationParams ?? {})) url.searchParams.set(key, value);
    return url;
  }

  async exchange(provider: string, code: string, verifier: string) {
    const config = this.config(provider);
    const client = new OAuth2Client(config.clientId, config.clientPassword ?? null, config.redirectUri);
    return client.validateAuthorizationCode(config.tokenEndpoint, code, verifier);
  }

  async refresh(provider: string, renewalCredential: string) {
    const config = this.config(provider);
    const client = new OAuth2Client(config.clientId, config.clientPassword ?? null, config.redirectUri);
    return client.refreshAccessToken(config.tokenEndpoint, renewalCredential, []);
  }
}
