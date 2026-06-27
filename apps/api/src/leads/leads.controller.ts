import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { LeadsService } from './leads.service';
@Controller('workspaces/:workspaceId')
export class LeadsController {
  constructor(private readonly service: LeadsService) {}
  @Get('leads') list(@Param('workspaceId') workspaceId: string) { return this.service.list(workspaceId); }
  @Patch('leads/:id/status') update(@Param('workspaceId') workspaceId: string, @Param('id') id: string, @Body('status') status: unknown) { return this.service.updateStatus(workspaceId, id, status); }
  @Post('posts/:postId/classify') classify(@Param('workspaceId') workspaceId: string, @Param('postId') postId: string) { return this.service.classify(workspaceId, postId); }
}
