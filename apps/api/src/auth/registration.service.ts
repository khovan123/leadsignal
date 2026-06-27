import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { PasswordService } from './password.service';
import { SessionService, type SessionContext } from './session.service';

@Injectable()
export class RegistrationService {
  constructor(private readonly prisma: PrismaService, private readonly passwords: PasswordService, private readonly sessions: SessionService) {}
  async execute(input: Record<string, unknown>, context: SessionContext) {
    const email = String(input.email ?? '').trim().toLowerCase();
    const displayName = String(input.displayName ?? '').trim();
    const password = String(input.password ?? '');
    const workspaceName = String(input.workspaceName ?? `${displayName || 'My'} workspace`).trim();
    if (!email.includes('@') || displayName.length < 2 || password.length < 12) throw new BadRequestException('Valid email, display name, and a password of at least 12 characters are required');
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException('Email is already registered');
    const passwordDigest = await this.passwords.hash(password);
    const slugBase = workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'workspace';
    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email, displayName } });
      await tx.userCredential.create({ data: { userId: user.id, passwordDigest } });
      const workspace = await tx.workspace.create({ data: { name: workspaceName, slug: `${slugBase}-${randomUUID().slice(0, 8)}` } });
      await tx.workspaceMember.create({ data: { workspaceId: workspace.id, userId: user.id, role: 'OWNER' } });
      return { user, workspace };
    });
    return this.sessions.start(created.user, created.workspace.id, context);
  }
}
