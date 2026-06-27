import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { InvitationsController } from './invitations.controller';
import { OAuthController } from './oauth.controller';
import { ProductionAuthGuard } from './production.guard';
import { ProductionService } from './production.service';
import { SessionController } from './session.controller';

@Global()
@Module({
  controllers: [SessionController, InvitationsController, OAuthController],
  providers: [
    ProductionService,
    { provide: APP_GUARD, useClass: ProductionAuthGuard },
  ],
  exports: [ProductionService],
})
export class ProductionModule {}
