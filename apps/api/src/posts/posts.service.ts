import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService, private readonly queue: QueueService) {}
  async ingest(workspaceId: string, input: Record<string, unknown>) {
    const externalPostId = String(input.externalPostId ?? '');
    const title = String(input.title ?? '');
    if (!externalPostId || !title) throw new BadRequestException('externalPostId and title are required');
    const sourceId = String(input.sourceId ?? '00000000-0000-4000-8000-000000000010');
    const source = await this.prisma.redditSource.upsert({
      where: { id: sourceId }, update: {},
      create: { id: sourceId, workspaceId, name: 'Manual ingest', type: 'MANUAL' },
    });
    const post = await this.prisma.redditPost.upsert({
      where: { externalPostId },
      update: { title, body: String(input.body ?? ''), score: Number(input.score ?? 0), commentCount: Number(input.commentCount ?? 0) },
      create: {
        externalPostId, title, body: String(input.body ?? ''), subreddit: String(input.subreddit ?? 'unknown'),
        authorUsername: input.authorUsername ? String(input.authorUsername) : null,
        permalink: String(input.permalink ?? `https://reddit.com/${externalPostId}`),
        score: Number(input.score ?? 0), commentCount: Number(input.commentCount ?? 0),
        postedAt: input.postedAt ? new Date(String(input.postedAt)) : new Date(),
      },
    });
    await this.prisma.postDiscovery.upsert({
      where: { workspaceId_postId_sourceId: { workspaceId, postId: post.id, sourceId: source.id } },
      update: { discoveredAt: new Date() }, create: { workspaceId, postId: post.id, sourceId: source.id },
    });
    const job = await this.queue.enqueueClassification(workspaceId, post.id);
    return { postId: post.id, jobId: job.id };
  }
}
