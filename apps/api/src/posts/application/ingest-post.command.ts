import { BadRequestException, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { QueueService } from '../../queue/queue.service';
import {
  REDDIT_POST_REPOSITORY,
  type IngestRedditPostInput,
  type RedditPostRepository,
} from '../domain/reddit-post.repository';

export class IngestPostCommand {
  constructor(
    readonly workspaceId: string,
    readonly payload: Record<string, unknown>,
  ) {}
}

function parseInput(input: Record<string, unknown>): IngestRedditPostInput {
  const externalPostId = String(input.externalPostId ?? '').trim();
  const title = String(input.title ?? '').trim();
  if (!externalPostId || !title) {
    throw new BadRequestException('externalPostId and title are required');
  }

  const postedAt = input.postedAt
    ? new Date(String(input.postedAt))
    : new Date();
  if (Number.isNaN(postedAt.getTime())) {
    throw new BadRequestException('postedAt must be a valid date');
  }

  return {
    externalPostId,
    title,
    body: String(input.body ?? ''),
    subreddit: String(input.subreddit ?? 'unknown'),
    authorUsername: input.authorUsername
      ? String(input.authorUsername)
      : null,
    permalink: String(
      input.permalink ?? `https://reddit.com/${externalPostId}`,
    ),
    score: Number(input.score ?? 0),
    commentCount: Number(input.commentCount ?? 0),
    postedAt,
    sourceId: String(
      input.sourceId ?? '00000000-0000-4000-8000-000000000010',
    ),
  };
}

@CommandHandler(IngestPostCommand)
export class IngestPostHandler implements ICommandHandler<IngestPostCommand> {
  constructor(
    @Inject(REDDIT_POST_REPOSITORY)
    private readonly posts: RedditPostRepository,
    private readonly queue: QueueService,
  ) {}

  async execute(command: IngestPostCommand) {
    const input = parseInput(command.payload);
    const { postId } = await this.posts.ingest(command.workspaceId, input);
    const job = await this.queue.enqueueClassification(
      command.workspaceId,
      postId,
    );
    return { postId, jobId: job.id };
  }
}
