import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaService } from '../database/prisma.service';
import { IngestPostHandler } from './application/ingest-post.command';
import { REDDIT_POST_REPOSITORY } from './domain/reddit-post.repository';
import { PrismaRedditPostRepository } from './infrastructure/prisma-reddit-post.repository';
import { PostsCqrsController } from './presentation/posts-cqrs.controller';

@Module({
  imports: [CqrsModule],
  controllers: [PostsCqrsController],
  providers: [
    IngestPostHandler,
    {
      provide: PrismaRedditPostRepository,
      useFactory: (prisma: PrismaService) => new PrismaRedditPostRepository(prisma),
      inject: [PrismaService],
    },
    { provide: REDDIT_POST_REPOSITORY, useExisting: PrismaRedditPostRepository },
  ],
})
export class PostsModule {}
