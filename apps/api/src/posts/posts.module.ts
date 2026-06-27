import { Inject, Module } from '@nestjs/common';
import { CommandHandler, CqrsModule } from '@nestjs/cqrs';
import { PrismaService } from '../database/prisma.service';
import { QueueService } from '../queue/queue.service';
import { IngestPostCommand, IngestPostHandler } from './application/ingest-post.command';
import { REDDIT_POST_REPOSITORY, type RedditPostRepository } from './domain/reddit-post.repository';
import { PrismaRedditPostRepository } from './infrastructure/prisma-reddit-post.repository';
import { PostsCqrsController } from './presentation/posts-cqrs.controller';

@CommandHandler(IngestPostCommand)
class WiredIngestPostHandler extends IngestPostHandler {
  constructor(
    @Inject(REDDIT_POST_REPOSITORY) posts: RedditPostRepository,
    @Inject(QueueService) queue: QueueService,
  ) {
    super(posts, queue);
  }
}

@Module({
  imports: [CqrsModule],
  controllers: [PostsCqrsController],
  providers: [
    WiredIngestPostHandler,
    {
      provide: PrismaRedditPostRepository,
      useFactory: (prisma: PrismaService) => new PrismaRedditPostRepository(prisma),
      inject: [PrismaService],
    },
    { provide: REDDIT_POST_REPOSITORY, useExisting: PrismaRedditPostRepository },
  ],
})
export class PostsModule {}
