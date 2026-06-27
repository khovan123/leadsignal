import { Inject, NotFoundException } from '@nestjs/common';
import {
  CommandHandler,
  ICommandHandler,
  IQueryHandler,
  QueryHandler,
} from '@nestjs/cqrs';
import { QueueService } from '../../queue/queue.service';
import {
  LEAD_REPOSITORY,
  type LeadRepository,
} from '../domain/lead.repository';
import { LeadStatus } from '../domain/lead-status.value-object';

export class ListLeadsQuery {
  constructor(readonly workspaceId: string) {}
}

export class UpdateLeadStatusCommand {
  constructor(
    readonly workspaceId: string,
    readonly leadId: string,
    readonly status: unknown,
  ) {}
}

export class ClassifyPostCommand {
  constructor(
    readonly workspaceId: string,
    readonly postId: string,
  ) {}
}

@QueryHandler(ListLeadsQuery)
export class ListLeadsHandler implements IQueryHandler<ListLeadsQuery> {
  constructor(
    @Inject(LEAD_REPOSITORY)
    private readonly leads: LeadRepository,
  ) {}

  execute(query: ListLeadsQuery) {
    return this.leads.listByWorkspace(query.workspaceId);
  }
}

@CommandHandler(UpdateLeadStatusCommand)
export class UpdateLeadStatusHandler
  implements ICommandHandler<UpdateLeadStatusCommand>
{
  constructor(
    @Inject(LEAD_REPOSITORY)
    private readonly leads: LeadRepository,
  ) {}

  async execute(command: UpdateLeadStatusCommand) {
    if (!(await this.leads.exists(command.workspaceId, command.leadId))) {
      throw new NotFoundException('Lead not found');
    }
    const status = LeadStatus.create(command.status);
    return this.leads.updateStatus(
      command.workspaceId,
      command.leadId,
      status.value,
    );
  }
}

@CommandHandler(ClassifyPostCommand)
export class ClassifyPostHandler
  implements ICommandHandler<ClassifyPostCommand>
{
  constructor(
    @Inject(LEAD_REPOSITORY)
    private readonly leads: LeadRepository,
    private readonly queue: QueueService,
  ) {}

  async execute(command: ClassifyPostCommand) {
    if (!(await this.leads.postExists(command.postId))) {
      throw new NotFoundException('Post not found');
    }
    return this.queue.enqueueClassification(
      command.workspaceId,
      command.postId,
    );
  }
}

export const LEAD_QUERY_HANDLERS = [ListLeadsHandler];
export const LEAD_COMMAND_HANDLERS = [
  UpdateLeadStatusHandler,
  ClassifyPostHandler,
];
