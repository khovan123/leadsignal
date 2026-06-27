import { Injectable } from '@nestjs/common';
import { ProductionService } from '../../production/production.service';
import type { ProviderOAuthPort } from '../application/provider-oauth.port';

@Injectable()
export class ProductionProviderOAuthAdapter implements ProviderOAuthPort {
  constructor(private readonly production: ProductionService) {}

  start(provider: string, workspaceId: string, userId: string) {
    return this.production.oauthStart(provider, workspaceId, userId);
  }

  complete(
    provider: string,
    code: string | undefined,
    state: string | undefined,
  ) {
    return this.production.oauthCallback(provider, code, state);
  }
}
