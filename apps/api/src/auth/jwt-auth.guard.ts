import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { PrismaService } from '../database/prisma.service';
import { TokenService } from './token.service';
import { ACCESS_COOKIE, PUBLIC_ROUTE } from './auth.constants';
import type { AuthenticatedUser } from './auth.decorators';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly tokens: TokenService, private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;
    const request = context.switchToHttp().getRequest<FastifyRequest & { user?: AuthenticatedUser; cookies?: Record<string, string> }>();
    const value = request.cookies?.[ACCESS_COOKIE];
    if (!value) throw new UnauthorizedException('Authentication required');
    const user = await this.tokens.verifyAccess(value);
    const session = await this.prisma.authSession.findUnique({ where: { id: user.sessionId }, select: { userId: true, revokedAt: true, expiresAt: true } });
    if (!session || session.userId !== user.id || session.revokedAt || session.expiresAt <= new Date()) throw new UnauthorizedException('Session is no longer active');
    request.user = user;
    return true;
  }
}
