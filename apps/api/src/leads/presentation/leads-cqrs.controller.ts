import {Body,Controller,Get,Inject,Param,Patch,Post} from '@nestjs/common';
import {CommandBus,QueryBus} from '@nestjs/cqrs';
import {ClassifyPostCommand,ListLeadsQuery,UpdateLeadStatusCommand} from '../application/leads.use-cases';
@Controller('workspaces/:workspaceId')
export class LeadsCqrsController{
 constructor(@Inject(CommandBus) private readonly commands:CommandBus,@Inject(QueryBus) private readonly queries:QueryBus){}
 @Get('leads') list(@Param('workspaceId') workspaceId:string){return this.queries.execute(new ListLeadsQuery(workspaceId));}
 @Patch('leads/:id/status') updateStatus(@Param('workspaceId') workspaceId:string,@Param('id') leadId:string,@Body('status') status:unknown){return this.commands.execute(new UpdateLeadStatusCommand(workspaceId,leadId,status));}
 @Post('posts/:postId/classify') classify(@Param('workspaceId') workspaceId:string,@Param('postId') postId:string){return this.commands.execute(new ClassifyPostCommand(workspaceId,postId));}
}
