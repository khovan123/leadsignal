import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ProductionService } from './production.service';
import { ProductionAuthGuard } from './production.guard';
import { SessionController } from './session.controller';
import { InvitationsController } from './invitations.controller';
import { OAuthController } from './oauth.controller';

@Module({
  controllers: [SessionController, InvitationsController, OAuthController],
  providers: [
    ProductionService,
    { provide: APP_GUARD, useClass: ProductionAuthGuard },
  ],
  exports: [ProductionService],
})
export class ProductionModule {}
