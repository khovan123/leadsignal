import { Controller, Get, Inject, Param } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
@Controller('workspaces')
export class WorkspacesController {
  constructor(@Inject(WorkspacesService) private readonly service:WorkspacesService){}
  @Get(':workspaceId') get(@Param('workspaceId') id:string){return this.service.get(id);}
}
