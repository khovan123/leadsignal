import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { IDENTITY_PORT } from './application/identity.port';
import { IDENTITY_COMMAND_HANDLERS } from './application/identity.use-cases';
import { ProductionIdentityAdapter } from './infrastructure/production-identity.adapter';
import { SessionController } from './presentation/session.controller';

@Module({
  imports: [CqrsModule],
  controllers: [SessionController],
  providers: [
    ...IDENTITY_COMMAND_HANDLERS,
    ProductionIdentityAdapter,
    { provide: IDENTITY_PORT, useExisting: ProductionIdentityAdapter },
  ],
})
export class IdentityModule {}
