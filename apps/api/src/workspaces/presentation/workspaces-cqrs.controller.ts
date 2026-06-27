import {Controller,Get,Inject,Param} from '@nestjs/common';
import {QueryBus} from '@nestjs/cqrs';
import {GetWorkspaceQuery} from '../application/get-workspace.query';
@Controller('workspaces')
export class WorkspacesCqrsController{
 constructor(@Inject(QueryBus) private readonly queries:QueryBus){}
 @Get(':workspaceId') get(@Param('workspaceId') workspaceId:string){return this.queries.execute(new GetWorkspaceQuery(workspaceId));}
}
