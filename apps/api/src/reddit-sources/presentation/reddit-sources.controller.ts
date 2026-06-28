import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  CreateRedditSourceCommand,
  DeleteRedditSourceCommand,
  GetRedditCollectionJobQuery,
  ListRedditSourcesQuery,
  RunRedditSourcesCommand,
  UpdateRedditSourceCommand,
} from '../application/reddit-source.use-cases';
import type { SaveRedditSourceInput } from '../domain/reddit-source.repository';

@Controller('workspaces/:workspaceId/reddit-sources')
export class RedditSourcesController {
  constructor(
    @Inject(CommandBus) private readonly commands: CommandBus,
    @Inject(QueryBus) private readonly queries: QueryBus,
  ) {}

  @Get()
  list(@Param('workspaceId') workspaceId: string) {
    return this.queries.execute(new ListRedditSourcesQuery(workspaceId));
  }

  @Post()
  create(
    @Param('workspaceId') workspaceId: string,
    @Req() request: any,
    @Body() body: SaveRedditSourceInput,
  ) {
    return this.commands.execute(
      new CreateRedditSourceCommand(workspaceId, request.user.sub, body),
    );
  }

  @Patch(':sourceId')
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('sourceId') sourceId: string,
    @Req() request: any,
    @Body() body: SaveRedditSourceInput,
  ) {
    return this.commands.execute(
      new UpdateRedditSourceCommand(
        workspaceId,
        request.user.sub,
        sourceId,
        body,
      ),
    );
  }

  @Delete(':sourceId')
  remove(
    @Param('workspaceId') workspaceId: string,
    @Param('sourceId') sourceId: string,
    @Req() request: any,
  ) {
    return this.commands.execute(
      new DeleteRedditSourceCommand(
        workspaceId,
        request.user.sub,
        sourceId,
      ),
    );
  }

  @Post('run')
  run(
    @Param('workspaceId') workspaceId: string,
    @Req() request: any,
    @Body('sourceIds') sourceIds?: string[],
  ) {
    return this.commands.execute(
      new RunRedditSourcesCommand(
        workspaceId,
        request.user.sub,
        sourceIds,
      ),
    );
  }

  @Get('jobs/:jobId')
  job(
    @Param('workspaceId') workspaceId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.queries.execute(
      new GetRedditCollectionJobQuery(workspaceId, jobId),
    );
  }
}
