import { Body, Controller, Inject, Param, Post, Req } from '@nestjs/common';
import { ProductionService } from './production.service';
@Controller()
export class InvitationsController {
  constructor(@Inject(ProductionService) private readonly service:ProductionService){}
  @Post('workspaces/:workspaceId/invitations') invite(@Param('workspaceId') workspaceId:string,@Req() request:any,@Body() body:{email?:string;role?:string}){return this.service.invite(workspaceId,request.user.sub,body);}
  @Post('invitations/accept') accept(@Req() request:any,@Body() body:{token?:string}){return this.service.acceptInvitation(body.token,request.user.sub);}
}
