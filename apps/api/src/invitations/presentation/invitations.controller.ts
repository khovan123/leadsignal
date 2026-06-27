import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  AcceptInvitationCommand,
  CreateInvitationCommand,
} from '../application/invitation.use-cases';

@Controller()
export class InvitationsController {
  constructor(private readonly commands: CommandBus) {}

  @Post('workspaces/:workspaceId/invitations')
  create(
    @Param('workspaceId') workspaceId: string,
    @Req() request: any,
    @Body() body: { email?: string; role?: string },
  ) {
    return this.commands.execute(
      new CreateInvitationCommand(workspaceId, request.user.sub, body),
    );
  }

  @Post('invitations/accept')
  accept(@Req() request: any, @Body('token') token: string | undefined) {
    return this.commands.execute(
      new AcceptInvitationCommand(token, request.user.sub),
    );
  }
}
