import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { QueueService } from '../queue/queue.service';
import { ExtensionAuthController } from './extension-auth.controller';
import { ExtensionAuthService } from './extension-auth.service';

@Module({
  controllers: [ExtensionAuthController],
  providers: [
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
