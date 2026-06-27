import {Body,Controller,Inject,Param,Post} from '@nestjs/common';
import {CommandBus} from '@nestjs/cqrs';
import {IngestPostCommand} from '../application/ingest-post.command';
@Controller('workspaces/:workspaceId/posts')
export class PostsCqrsController{
 constructor(@Inject(CommandBus) private readonly commands:CommandBus){}
 @Post('ingest') ingest(@Param('workspaceId') workspaceId:string,@Body() body:Record<string,unknown>){return this.commands.execute(new IngestPostCommand(workspaceId,body));}
}
