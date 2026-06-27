import { Inject, Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { IngestPostCommand } from './application/ingest-post.command';

@Injectable()
export class PostsService {
  constructor(@Inject(CommandBus) private readonly commands: CommandBus) {}

  ingest(workspaceId: string, input: Record<string, unknown>) {
    return this.commands.execute(new IngestPostCommand(workspaceId, input));
  }
}
