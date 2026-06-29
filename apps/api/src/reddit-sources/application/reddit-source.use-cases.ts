import { BadRequestException, Inject, NotFoundException } from '@nestjs/common';
import {
  CommandHandler,
  ICommandHandler,
  IQueryHandler,
  QueryHandler,
} from '@nestjs/cqrs';
import { QueueService } from '../../queue/queue.service';
import {
  REDDIT_SOURCE_REPOSITORY,
  type IRedditSourceRepository,
  type SaveRedditSourceInput,
} from '../domain/reddit-source.repository';

function assertSupportedSourceType(input: SaveRedditSourceInput) {
  if (String(input.type ?? '').trim().toUpperCase() === 'LATEST') {
    throw new BadRequestException('LATEST Reddit sources are no longer supported');
  }
}

export class ListRedditSourcesQuery {
  constructor(
    readonly workspaceId: string,
    readonly userId: string,
  ) {}
}

export class GetRedditCollectionJobQuery {
  constructor(
    readonly workspaceId: string,
    readonly userId: string,
    readonly jobId: string,
  ) {}
}

export class CreateRedditSourceCommand {
  constructor(
    readonly workspaceId: string,
    readonly userId: string,
    readonly input: SaveRedditSourceInput,
  ) {}
}

export class UpdateRedditSourceCommand {
  constructor(
    readonly workspaceId: string,
    readonly userId: string,
    readonly sourceId: string,
    readonly input: SaveRedditSourceInput,
  ) {}
}

export class DeleteRedditSourceCommand {
  constructor(
    readonly workspaceId: string,
    readonly userId: string,
    readonly sourceId: string,
  ) {}
}

export class RunRedditSourcesCommand {
  constructor(
    readonly workspaceId: string,
    readonly userId: string,
    readonly sourceIds?: string[],
  ) {}
}

@QueryHandler(ListRedditSourcesQuery)
export class ListRedditSourcesHandler
  implements IQueryHandler<ListRedditSourcesQuery>
{
  constructor(
    @Inject(REDDIT_SOURCE_REPOSITORY)
    private readonly repository: IRedditSourceRepository,
  ) {}

  async execute(query: ListRedditSourcesQuery) {
    await this.repository.assertWorkspaceMember(query.workspaceId, query.userId);
    return this.repository.list(query.workspaceId, query.userId);
  }
}

@QueryHandler(GetRedditCollectionJobQuery)
export class GetRedditCollectionJobHandler
  implements IQueryHandler<GetRedditCollectionJobQuery>
{
  constructor(@Inject(QueueService) private readonly queue: QueueService) {}

  async execute(query: GetRedditCollectionJobQuery) {
    const job = await this.queue.getRedditCollectionJob(query.jobId);
    if (
      !job ||
      job.workspaceId !== query.workspaceId ||
      job.userId !== query.userId
    ) {
      throw new NotFoundException('Reddit collection job not found');
    }
    return job;
  }
}

@CommandHandler(CreateRedditSourceCommand)
export class CreateRedditSourceHandler
  implements ICommandHandler<CreateRedditSourceCommand>
{
  constructor(
    @Inject(REDDIT_SOURCE_REPOSITORY)
    private readonly repository: IRedditSourceRepository,
  ) {}

  async execute(command: CreateRedditSourceCommand) {
    assertSupportedSourceType(command.input);
    await this.repository.assertWorkspaceMember(command.workspaceId, command.userId);
    return this.repository.create(
      command.workspaceId,
      command.userId,
      command.input,
    );
  }
}

@CommandHandler(UpdateRedditSourceCommand)
export class UpdateRedditSourceHandler
  implements ICommandHandler<UpdateRedditSourceCommand>
{
  constructor(
    @Inject(REDDIT_SOURCE_REPOSITORY)
    private readonly repository: IRedditSourceRepository,
  ) {}

  async execute(command: UpdateRedditSourceCommand) {
    assertSupportedSourceType(command.input);
    await this.repository.assertWorkspaceMember(command.workspaceId, command.userId);
    return this.repository.update(
      command.workspaceId,
      command.userId,
      command.sourceId,
      command.input,
    );
  }
}

@CommandHandler(DeleteRedditSourceCommand)
export class DeleteRedditSourceHandler
  implements ICommandHandler<DeleteRedditSourceCommand>
{
  constructor(
    @Inject(REDDIT_SOURCE_REPOSITORY)
    private readonly repository: IRedditSourceRepository,
  ) {}

  async execute(command: DeleteRedditSourceCommand) {
    await this.repository.assertWorkspaceMember(command.workspaceId, command.userId);
    await this.repository.remove(
      command.workspaceId,
      command.userId,
      command.sourceId,
    );
    return { success: true };
  }
}

@CommandHandler(RunRedditSourcesCommand)
export class RunRedditSourcesHandler
  implements ICommandHandler<RunRedditSourcesCommand>
{
  constructor(
    @Inject(REDDIT_SOURCE_REPOSITORY)
    private readonly repository: IRedditSourceRepository,
    @Inject(QueueService) private readonly queue: QueueService,
  ) {}

  async execute(command: RunRedditSourcesCommand) {
    await this.repository.assertWorkspaceMember(command.workspaceId, command.userId);
    const sources = await this.repository.list(
      command.workspaceId,
      command.userId,
    );
    const allowed = new Set(sources.map((source) => source.id));

    if (
      command.sourceIds?.length &&
      command.sourceIds.some((sourceId) => !allowed.has(sourceId))
    ) {
      throw new BadRequestException(
        'One or more Reddit sources do not belong to the current member',
      );
    }

    const sourceIds = command.sourceIds?.length
      ? command.sourceIds
      : sources.map((source) => source.id);
    if (sourceIds.length === 0) {
      throw new BadRequestException('No Reddit sources are configured for this member');
    }

    const job = await this.queue.enqueueRedditCollection(
      command.workspaceId,
      command.userId,
      sourceIds,
    );
    return { jobId: String(job.id), status: 'QUEUED' };
  }
}

export const REDDIT_SOURCE_HANDLERS = [
  ListRedditSourcesHandler,
  GetRedditCollectionJobHandler,
  CreateRedditSourceHandler,
  UpdateRedditSourceHandler,
  DeleteRedditSourceHandler,
  RunRedditSourcesHandler,
];
