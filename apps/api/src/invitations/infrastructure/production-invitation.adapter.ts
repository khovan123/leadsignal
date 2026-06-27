import {Inject,Injectable} from '@nestjs/common';
import {InvitationService} from '../../production/invitation.service';
import {ProductionService} from '../../production/production.service';
import type {InvitationPort} from '../application/invitation.port';
@Injectable()
export class ProductionInvitationAdapter implements InvitationPort{
 constructor(@Inject(InvitationService) private readonly invitations:InvitationService,@Inject(ProductionService) private readonly production:ProductionService){}
 create(workspaceId:string,invitedByUserId:string,input:{email?:string;role?:string}){return this.invitations.invite(workspaceId,invitedByUserId,input);}
 accept(token:string|undefined,userId:string){return this.production.acceptInvitation(token,userId);}
}
