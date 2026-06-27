import { Body, Controller, Inject, Param, Post, Req } from '@nestjs/common';
import { InvitationService } from './invitation.service';
import { ProductionService } from './production.service';

@Controller()
export class InvitationsController {
  constructor(
    @Inject(InvitationService)
    private readonly invitations: InvitationService,
    @Inject(ProductionService)
    private readonly production: ProductionService,
  ) {}

  @Post('workspaces/:workspaceId/invitations')
  invite(
    @Param('workspaceId') workspaceId: string,
    @Req() request: any,
    @Body() body: { email?: string; role?: string },
  ) {
    return this.invitations.invite(workspaceId, request.user.sub, body);
  }

  @Post('invitations/accept')
  accept(@Req() request: any, @Body() body: { token?: string }) {
    return this.production.acceptInvitation(body.token, request.user.sub);
  }
}
