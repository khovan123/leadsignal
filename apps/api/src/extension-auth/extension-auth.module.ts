import { Module } from '@nestjs/common';
import { CryptoService } from '../crypto/crypto.service';
import { PrismaService } from '../database/prisma.service';
import { QueueService } from '../queue/queue.service';
import { ExtensionAuthController } from './extension-auth.controller';
import { ExtensionAuthService } from './extension-auth.service';
import { RedditSessionSyncService } from './reddit-session-sync.service';

@Module({
  controllers: [ExtensionAuthController],
  providers: [
    CryptoService,
    RedditSessionSyncService,
    {
      provide: ExtensionAuthService,
      useFactory: (prisma: PrismaService, queue: QueueService) =>
        new ExtensionAuthService(prisma, queue),
      inject: [PrismaService, QueueService],
    },
  ],
  exports: [ExtensionAuthService],
})
export class ExtensionAuthModule {}
