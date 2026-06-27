import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { randomToken, tokenHash } from './security';

@Injectable()
export class InvitationService {
  constructor(private readonly prisma: PrismaService) {}

  async invite(workspaceId: string, invitedByUserId: string, input: { email?: string; role?: string }) {
    const email = input.email?.trim().toLowerCase();
    if (!email) throw new BadRequestException('email is required');
    const role = ['ADMIN', 'MEMBER', 'VIEWER'].includes(input.role ?? '') ? input.role! : 'MEMBER';
    const memberships = await this.prisma.$queryRaw<{ role: string; locale: string }[]>`
      SELECT member.role::text, workspace.locale
      FROM "WorkspaceMember" member
      JOIN "Workspace" workspace ON workspace.id=member."workspaceId"
      WHERE member."workspaceId"=${workspaceId}::uuid
        AND member."userId"=${invitedByUserId}::uuid
      LIMIT 1
    `;
    const membership = memberships[0];
    if (!['OWNER', 'ADMIN'].includes(membership?.role ?? '')) {
      throw new ForbiddenException('Only owners and admins can invite members');
    }

    const token = randomToken();
    const expiresAt = new Date(Date.now() + 7 * 86400000);
    const appUrl = process.env.PUBLIC_APP_URL ?? 'http://localhost:3000';
    const locale = membership.locale === 'en' ? 'en' : 'vi';
    const inviteUrl = `${appUrl}/${locale}/invite?token=${encodeURIComponent(token)}`;
    const subject = 'LeadSignal workspace invitation';
    const body = `Open this address to join the workspace: ${inviteUrl}`;

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "WorkspaceInvitation"
          (id,"workspaceId",email,role,"tokenHash","invitedByUserId","expiresAt")
        VALUES
          (${randomUUID()}::uuid,${workspaceId}::uuid,${email},${role}::"WorkspaceRole",${tokenHash(token)},${invitedByUserId}::uuid,${expiresAt})
      `;
      await tx.$executeRaw`
        INSERT INTO "EmailOutbox"
          (id,recipient,"subjectLine","bodyHtml","availableAt","createdAt","updatedAt")
        VALUES
          (${randomUUID()}::uuid,${email},${subject},${body},NOW(),NOW(),NOW())
      `;
    });

    return { success: true, queued: true, ...(process.env.NODE_ENV === 'production' ? {} : { inviteUrl, token }) };
  }
}
