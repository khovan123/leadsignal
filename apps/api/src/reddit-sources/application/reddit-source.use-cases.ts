import { Inject } from '@nestjs/common';
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

export class ListRedditSourcesQuery {
  constructor(readonly workspaceId: string) {}
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

  execute(query: ListRedditSourcesQuery) {
    return this.repository.list(query.workspaceId);
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
    await this.repository.assertCanManage(command.workspaceId, command.userId);
    return this.repository.create(command.workspaceId, command.input);
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
    await this.repository.assertCanManage(command.workspaceId, command.userId);
    return this.repository.update(
      command.workspaceId,
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
    await this.repository.assertCanManage(command.workspaceId, command.userId);
    await this.repository.remove(command.workspaceId, command.sourceId);
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
    await this.repository.assertCanManage(command.workspaceId, command.userId);
    if (command.sourceIds?.length) {
      const sources = await this.repository.list(command.workspaceId);
      const allowed = new Set(sources.map((source) => source.id));
      for (const sourceId of command.sourceIds) {
        if (!allowed.has(sourceId)) {
          throw new Error('One or more Reddit sources do not belong to the workspace');
        }
      }
    }
    const job = await this.queue.enqueueRedditCollection(
      command.workspaceId,
      command.sourceIds,
    );
    return { jobId: String(job.id), status: 'QUEUED' };
  }
}

export const REDDIT_SOURCE_HANDLERS = [
  ListRedditSourcesHandler,
  CreateRedditSourceHandler,
  UpdateRedditSourceHandler,
  DeleteRedditSourceHandler,
  RunRedditSourcesHandler,
];
