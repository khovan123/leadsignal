import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CryptoService } from '../crypto/crypto.service';
import { PrismaService } from '../database/prisma.service';
import { QueueService } from '../queue/queue.service';
import { EmailOutboxService } from './email-outbox.service';
import { InvitationService } from './invitation.service';
import { InvitationsController } from './invitations.controller';
import { OAuthController } from './oauth.controller';
import { ProductionAuthGuard } from './production.guard';
import { ProductionService } from './production.service';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitService } from './rate-limit.service';
import { SessionController } from './session.controller';

@Global()
@Module({
  controllers: [SessionController, InvitationsController, OAuthController],
  providers: [
    {
      provide: ProductionService,
      useFactory: (
        prisma: PrismaService,
        crypto: CryptoService,
        queue: QueueService,
      ) => new ProductionService(prisma, crypto, queue),
      inject: [PrismaService, CryptoService, QueueService],
    },
    {
      provide: InvitationService,
      useFactory: (prisma: PrismaService) => new InvitationService(prisma),
      inject: [PrismaService],
    },
    {
      provide: EmailOutboxService,
      useFactory: (prisma: PrismaService) => new EmailOutboxService(prisma),
      inject: [PrismaService],
    },
    RateLimitService,
    {
      provide: ProductionAuthGuard,
      useFactory: (prisma: PrismaService) => new ProductionAuthGuard(prisma),
      inject: [PrismaService],
    },
    {
      provide: RateLimitGuard,
      useFactory: (limiter: RateLimitService) => new RateLimitGuard(limiter),
      inject: [RateLimitService],
    },
    { provide: APP_GUARD, useExisting: ProductionAuthGuard },
    { provide: APP_GUARD, useExisting: RateLimitGuard },
  ],
  exports: [ProductionService, EmailOutboxService],
})
export class ProductionModule {}
