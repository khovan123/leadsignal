import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { QueueService } from '../queue/queue.service';
import { RedditPublicCollectorService } from './reddit-public-collector.service';

@Module({
  providers: [
    {
      provide: RedditPublicCollectorService,
      useFactory: (prisma: PrismaService, queue: QueueService) =>
        new RedditPublicCollectorService(prisma, queue),
      inject: [PrismaService, QueueService],
    },
  ],
  exports: [RedditPublicCollectorService],
})
export class RedditPublicModule {}
