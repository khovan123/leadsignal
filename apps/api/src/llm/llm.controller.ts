import { Body, Controller, Delete, Get, Headers, Param, Post } from '@nestjs/common';
import { LlmService } from './llm.service';

@Controller('workspaces/:workspaceId/llm')
export class LlmController {
  constructor(private readonly service: LlmService) {}
  private user(value?: string) { if (!value) throw new Error('x-user-id header is required'); return value; }

  @Get('connections') list(@Param('workspaceId') workspaceId: string) { return this.service.list(workspaceId); }
  @Post('connections') create(@Param('workspaceId') workspaceId: string, @Headers('x-user-id') userId: string, @Body() body: unknown) { return this.service.create(workspaceId, this.user(userId), body); }
  @Post('connections/:id/verify') verify(@Param('workspaceId') workspaceId: string, @Headers('x-user-id') userId: string, @Param('id') id: string) { return this.service.verify(workspaceId, this.user(userId), id); }
  @Delete('connections/:id') remove(@Param('workspaceId') workspaceId: string, @Headers('x-user-id') userId: string, @Param('id') id: string) { return this.service.remove(workspaceId, this.user(userId), id); }
}
