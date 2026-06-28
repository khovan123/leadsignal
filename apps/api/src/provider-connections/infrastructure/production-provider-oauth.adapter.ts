import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ProductionService } from '../../production/production.service';
import type { ProviderOAuthPort } from '../application/provider-oauth.port';

@Injectable()
export class ProductionProviderOAuthAdapter implements ProviderOAuthPort {
  constructor(
    @Inject(ProductionService)
    private readonly production: ProductionService,
  ) {}

  async start(provider: string, workspaceId: string, userId: string) {
    if (provider.toLowerCase() === 'reddit') {
      return {
        provider: 'reddit',
        workspaceId,
        userId,
        mode: 'COLLECTOR',
        message: 'Reddit sources are collected without OAuth credentials.',
      };
    }
    return this.production.oauthStart(provider, workspaceId, userId);
  }

  async complete(
    provider: string,
    code: string | undefined,
    state: string | undefined,
  ) {
    if (provider.toLowerCase() === 'reddit') {
      throw new BadRequestException('Reddit OAuth callback is disabled.');
    }
    return this.production.oauthCallback(provider, code, state);
  }
}
