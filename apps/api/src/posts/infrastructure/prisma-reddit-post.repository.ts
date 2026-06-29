import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type {
  IngestRedditPostInput,
  IngestedPost,
  RedditPostRepository,
} from '../domain/reddit-post.repository';
import { registerWorkspacePostDiscovery } from './workspace-discovery';

@Injectable()
export class PrismaRedditPostRepository implements RedditPostRepository {
  constructor(private readonly prisma: PrismaService) {}

  async ingest(
    workspaceId: string,
    userId: string,
    input: IngestRedditPostInput,
  ): Promise<IngestedPost> {
    const { sourceId, postId } = await this.prisma.$transaction(async (tx) => {
      const source = await tx.redditSource.upsert({
        where: { id: input.sourceId },
        update: {},
        create: {
          id: input.sourceId,
          workspaceId,
          ownerUserId: userId,
          name: 'Manual ingest',
          type: 'MANUAL',
        },
      });
      const post = await tx.redditPost.upsert({
        where: { externalPostId: input.externalPostId },
        update: {
          title: input.title,
          body: input.body,
          score: input.score,
          commentCount: input.commentCount,
        },
        create: {
          externalPostId: input.externalPostId,
          title: input.title,
          body: input.body,
          subreddit: input.subreddit,
          authorUsername: input.authorUsername,
          permalink: input.permalink,
          score: input.score,
          commentCount: input.commentCount,
          postedAt: input.postedAt,
        },
      });
      return { sourceId: source.id, postId: post.id };
    });

    await registerWorkspacePostDiscovery(
      this.prisma,
      workspaceId,
      postId,
      sourceId,
    );
    return { postId };
  }
}
