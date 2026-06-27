import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  INVITATION_PORT,
  type InvitationPort,
} from './invitation.port';

export class CreateInvitationCommand {
  constructor(
    readonly workspaceId: string,
    readonly invitedByUserId: string,
    readonly input: { email?: string; role?: string },
  ) {}
}

export class AcceptInvitationCommand {
  constructor(
    readonly token: string | undefined,
    readonly userId: string,
  ) {}
}

@CommandHandler(CreateInvitationCommand)
export class CreateInvitationHandler
  implements ICommandHandler<CreateInvitationCommand>
{
  constructor(
    @Inject(INVITATION_PORT)
    private readonly invitations: InvitationPort,
  ) {}

  execute(command: CreateInvitationCommand) {
    return this.invitations.create(
      command.workspaceId,
      command.invitedByUserId,
      command.input,
    );
  }
}

@CommandHandler(AcceptInvitationCommand)
export class AcceptInvitationHandler
  implements ICommandHandler<AcceptInvitationCommand>
{
  constructor(
    @Inject(INVITATION_PORT)
    private readonly invitations: InvitationPort,
  ) {}

  execute(command: AcceptInvitationCommand) {
    return this.invitations.accept(command.token, command.userId);
  }
}

export const INVITATION_COMMAND_HANDLERS = [
  CreateInvitationHandler,
  AcceptInvitationHandler,
];
