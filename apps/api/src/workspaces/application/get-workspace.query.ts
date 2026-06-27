import { Inject, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  WORKSPACE_REPOSITORY,
  type WorkspaceRepository,
} from '../domain/workspace.repository';

export class GetWorkspaceQuery {
  constructor(readonly workspaceId: string) {}
}

@QueryHandler(GetWorkspaceQuery)
export class GetWorkspaceHandler
  implements IQueryHandler<GetWorkspaceQuery>
{
  constructor(
    @Inject(WORKSPACE_REPOSITORY)
    private readonly workspaces: WorkspaceRepository,
  ) {}

  async execute(query: GetWorkspaceQuery) {
    const workspace = await this.workspaces.findDetails(query.workspaceId);
    if (!workspace) throw new NotFoundException('Workspace not found');
    return workspace;
  }
}
