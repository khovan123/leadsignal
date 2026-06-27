import {Body,Controller,Delete,Get,Inject,Param,Post,Req} from '@nestjs/common';
import {CommandBus,QueryBus} from '@nestjs/cqrs';
import {CreateLlmConnectionCommand,ListLlmConnectionsQuery,RemoveLlmConnectionCommand,VerifyLlmConnectionCommand} from '../application/llm-connections.use-cases';
@Controller('workspaces/:workspaceId/llm')
export class LlmHttpController{
 constructor(@Inject(CommandBus) private readonly commands:CommandBus,@Inject(QueryBus) private readonly queries:QueryBus){}
 @Get('connections') list(@Param('workspaceId') workspaceId:string){return this.queries.execute(new ListLlmConnectionsQuery(workspaceId));}
 @Post('connections') create(@Param('workspaceId') workspaceId:string,@Req() request:any,@Body() body:unknown){return this.commands.execute(new CreateLlmConnectionCommand(workspaceId,request.user.sub,body));}
 @Post('connections/:id/verify') verify(@Param('workspaceId') workspaceId:string,@Req() request:any,@Param('id') id:string){return this.commands.execute(new VerifyLlmConnectionCommand(workspaceId,request.user.sub,id));}
 @Delete('connections/:id') remove(@Param('workspaceId') workspaceId:string,@Req() request:any,@Param('id') id:string){return this.commands.execute(new RemoveLlmConnectionCommand(workspaceId,request.user.sub,id));}
}
