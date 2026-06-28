import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { verifyAccessToken } from './security';

@Injectable()
export class ProductionAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<any>();
    const path = request.url?.split('?')[0] ?? '';
    const publicPrefix = path.startsWith('/api/auth/extension/');
    const publicDeviceRoute = path === '/api/extension/ingest' || path === '/api/extension/source-settings';
    const existingPublic = /^\/api\/(health|auth\/(register|login|refresh)|connections\/[^/]+\/complete)/.test(path);
    if (publicPrefix || publicDeviceRoute || existingPublic) return true;

    const authorization = request.headers?.authorization as string | undefined;
    if (!authorization?.startsWith('Bearer ')) throw new UnauthorizedException('Bearer access token is required');
    let claims;
    try { claims = verifyAccessToken(authorization.slice(7)); }
    catch (error) { throw new UnauthorizedException(error instanceof Error ? error.message : 'Invalid access token'); }

    const sessions = await this.prisma.$queryRaw<{ revokedAt: Date | null; expiresAt: Date }[]>`SELECT "revokedAt","expiresAt" FROM "AuthSession" WHERE id=${claims.sid}::uuid AND "userId"=${claims.sub}::uuid LIMIT 1`;
    const session = sessions[0];
    if (!session || session.revokedAt || new Date(session.expiresAt) <= new Date()) throw new UnauthorizedException('Session is no longer active');

    request.user = claims;
    request.headers['x-user-id'] = claims.sub;
    const workspaceId = request.params?.workspaceId ?? request.query?.workspaceId;
    if (workspaceId) {
      const membership = await this.prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "WorkspaceMember" WHERE "workspaceId"=${workspaceId}::uuid AND "userId"=${claims.sub}::uuid LIMIT 1`;
      if (!membership.length) throw new ForbiddenException('You are not a member of this workspace');
      request.headers['x-workspace-id'] = workspaceId;
    }
    return true;
  }
}
