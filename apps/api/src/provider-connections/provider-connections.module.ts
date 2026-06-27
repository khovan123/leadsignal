import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PROVIDER_OAUTH_PORT } from './application/provider-oauth.port';
import { PROVIDER_OAUTH_COMMAND_HANDLERS } from './application/provider-oauth.use-cases';
import { ProductionProviderOAuthAdapter } from './infrastructure/production-provider-oauth.adapter';
import { ProviderOAuthController } from './presentation/provider-oauth.controller';

@Module({
  imports: [CqrsModule],
  controllers: [ProviderOAuthController],
  providers: [
    ...PROVIDER_OAUTH_COMMAND_HANDLERS,
    ProductionProviderOAuthAdapter,
    {
      provide: PROVIDER_OAUTH_PORT,
      useExisting: ProductionProviderOAuthAdapter,
    },
  ],
})
export class ProviderConnectionsModule {}
