import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { IngestPostHandler } from './application/ingest-post.command';
import { REDDIT_POST_REPOSITORY } from './domain/reddit-post.repository';
import { PrismaRedditPostRepository } from './infrastructure/prisma-reddit-post.repository';
import { PostsController } from './presentation/posts.controller';

@Module({
  imports: [CqrsModule],
  controllers: [PostsController],
  providers: [
    IngestPostHandler,
    PrismaRedditPostRepository,
    {
      provide: REDDIT_POST_REPOSITORY,
      useExisting: PrismaRedditPostRepository,
    },
  ],
})
export class PostsModule {}
