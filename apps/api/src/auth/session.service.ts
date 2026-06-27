import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { PrismaService } from '../database/prisma.service';
import { TokenService } from './token.service';
import type { AuthenticatedUser } from './decorators';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export type SessionContext = { userAgent?: string; ipAddress?: string };

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService, private readonly tokens: TokenService) {}

  async start(user: { id: string; email: string; displayName: string }, workspaceId: string, context: SessionContext) {
    const familyId = crypto.randomUUID();
    const renewal = this.tokens.createRefreshToken();
    await this.prisma.authSession.create({ data: { id: renewal.sessionId, userId: user.id, familyId, secretDigest: renewal.hash, userAgent: context.userAgent, ipAddress: context.ipAddress, expiresAt: new Date(Date.now() + SESSION_TTL_MS) } });
    return { accessToken: await this.tokens.issueAccess(user, renewal.sessionId), refreshToken: renewal.token, workspaceId, user: { id: user.id, email: user.email, displayName: user.displayName } };
  }

  async rotate(value: string | undefined, context: SessionContext) {
    if (!value) throw new UnauthorizedException('Session renewal is required');
    const current = await this.prisma.authSession.findUnique({ where: { secretDigest: this.tokens.hash(value) } });
    if (!current) throw new UnauthorizedException('Session renewal is invalid');
    if (current.revokedAt) {
      await this.revokeFamily(current.familyId, 'REUSE_DETECTED');
      throw new UnauthorizedException('Session family revoked');
    }
    if (current.expiresAt <= new Date()) throw new UnauthorizedException('Session expired');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: current.userId } });
    const next = this.tokens.createRefreshToken();
    await this.prisma.$transaction(async (tx) => {
      const claim = await tx.authSession.updateMany({ where: { id: current.id, revokedAt: null }, data: { revokedAt: new Date(), rotatedAt: new Date(), revokeReason: 'ROTATED' } });
      if (claim.count !== 1) {
        await tx.authSession.updateMany({ where: { familyId: current.familyId, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: 'REUSE_DETECTED' } });
        throw new UnauthorizedException('Session family revoked');
      }
      await tx.authSession.create({ data: { id: next.sessionId, userId: current.userId, familyId: current.familyId, secretDigest: next.hash, userAgent: context.userAgent, ipAddress: context.ipAddress, expiresAt: new Date(Date.now() + SESSION_TTL_MS) } });
    });
    const membership = await this.prisma.workspaceMember.findFirst({ where: { userId: current.userId }, orderBy: { createdAt: 'asc' } });
    return { accessToken: await this.tokens.issueAccess(user, next.sessionId), refreshToken: next.token, workspaceId: membership?.workspaceId, user: { id: user.id, email: user.email, displayName: user.displayName } };
  }

  async end(value?: string): Promise<void> {
    if (!value) return;
    await this.prisma.authSession.updateMany({ where: { secretDigest: this.tokens.hash(value), revokedAt: null }, data: { revokedAt: new Date(), revokeReason: 'LOGOUT' } });
  }

  async authenticate(request: FastifyRequest & { cookies?: Record<string, string> }): Promise<AuthenticatedUser> {
    const authorization = request.headers.authorization;
    const bearer = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
    const value = bearer ?? request.cookies?.ls_access;
    if (!value) throw new UnauthorizedException('Authentication required');
    const user = await this.tokens.verifyAccess(value);
    const row = await this.prisma.authSession.findUnique({ where: { id: user.sessionId } });
    if (!row || row.userId !== user.id || row.revokedAt || row.expiresAt <= new Date()) throw new UnauthorizedException('Session is no longer active');
    return user;
  }

  private async revokeFamily(familyId: string, reason: string) {
    await this.prisma.authSession.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: reason } });
  }
}
