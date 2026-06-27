import { Inject } from '@nestjs/common';
import {
  CommandHandler,
  ICommandHandler,
  IQueryHandler,
  QueryHandler,
} from '@nestjs/cqrs';
import {
  LLM_CONNECTIONS_PORT,
  type LlmConnectionsPort,
} from './llm-connections.port';

export class ListLlmConnectionsQuery {
  constructor(readonly workspaceId: string) {}
}

export class CreateLlmConnectionCommand {
  constructor(
    readonly workspaceId: string,
    readonly ownerUserId: string,
    readonly input: unknown,
  ) {}
}

export class VerifyLlmConnectionCommand {
  constructor(
    readonly workspaceId: string,
    readonly ownerUserId: string,
    readonly connectionId: string,
  ) {}
}

export class RemoveLlmConnectionCommand {
  constructor(
    readonly workspaceId: string,
    readonly ownerUserId: string,
    readonly connectionId: string,
  ) {}
}

@QueryHandler(ListLlmConnectionsQuery)
export class ListLlmConnectionsHandler
  implements IQueryHandler<ListLlmConnectionsQuery>
{
  constructor(
    @Inject(LLM_CONNECTIONS_PORT)
    private readonly connections: LlmConnectionsPort,
  ) {}

  execute(query: ListLlmConnectionsQuery) {
    return this.connections.list(query.workspaceId);
  }
}

@CommandHandler(CreateLlmConnectionCommand)
export class CreateLlmConnectionHandler
  implements ICommandHandler<CreateLlmConnectionCommand>
{
  constructor(
    @Inject(LLM_CONNECTIONS_PORT)
    private readonly connections: LlmConnectionsPort,
  ) {}

  execute(command: CreateLlmConnectionCommand) {
    return this.connections.create(
      command.workspaceId,
      command.ownerUserId,
      command.input,
    );
  }
}

@CommandHandler(VerifyLlmConnectionCommand)
export class VerifyLlmConnectionHandler
  implements ICommandHandler<VerifyLlmConnectionCommand>
{
  constructor(
    @Inject(LLM_CONNECTIONS_PORT)
    private readonly connections: LlmConnectionsPort,
  ) {}

  execute(command: VerifyLlmConnectionCommand) {
    return this.connections.verify(
      command.workspaceId,
      command.ownerUserId,
      command.connectionId,
    );
  }
}

@CommandHandler(RemoveLlmConnectionCommand)
export class RemoveLlmConnectionHandler
  implements ICommandHandler<RemoveLlmConnectionCommand>
{
  constructor(
    @Inject(LLM_CONNECTIONS_PORT)
    private readonly connections: LlmConnectionsPort,
  ) {}

  execute(command: RemoveLlmConnectionCommand) {
    return this.connections.remove(
      command.workspaceId,
      command.ownerUserId,
      command.connectionId,
    );
  }
}

export const LLM_CONNECTION_QUERY_HANDLERS = [ListLlmConnectionsHandler];
export const LLM_CONNECTION_COMMAND_HANDLERS = [
  CreateLlmConnectionHandler,
  VerifyLlmConnectionHandler,
  RemoveLlmConnectionHandler,
];
