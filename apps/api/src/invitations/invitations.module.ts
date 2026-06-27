import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { INVITATION_PORT } from './application/invitation.port';
import { INVITATION_COMMAND_HANDLERS } from './application/invitation.use-cases';
import { ProductionInvitationAdapter } from './infrastructure/production-invitation.adapter';
import { InvitationsController } from './presentation/invitations.controller';
@Module({
  imports:[CqrsModule],
  controllers:[InvitationsController],
  providers:[...INVITATION_COMMAND_HANDLERS,ProductionInvitationAdapter,{provide:INVITATION_PORT,useExisting:ProductionInvitationAdapter}],
})
export class InvitationsModule {}
