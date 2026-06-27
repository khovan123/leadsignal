import { Body, Controller, Param, Post } from '@nestjs/common';
import { PostsService } from './posts.service';
@Controller('workspaces/:workspaceId/posts')
export class PostsController {
  constructor(private readonly service: PostsService) {}
  @Post('ingest') ingest(@Param('workspaceId') workspaceId: string, @Body() body: Record<string, unknown>) { return this.service.ingest(workspaceId, body); }
}
