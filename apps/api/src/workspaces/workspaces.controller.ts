import { Controller, Get, Param } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly service: WorkspacesService) {}
  @Get(':workspaceId') get(@Param('workspaceId') id: string) { return this.service.get(id); }
}
