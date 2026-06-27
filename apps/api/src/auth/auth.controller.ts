import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { PrismaService } from '../database/prisma.service';
import { CurrentUser, Public, type AuthenticatedUser } from './decorators';
import { SessionService } from './session.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly sessions: SessionService, private readonly prisma: PrismaService) {}

  @Public()
  @Post('refresh')
  async refresh(@Req() request: FastifyRequest & { cookies?: Record<string, string> }, @Body() body: Record<string, unknown>, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.sessions.rotate(request.cookies?.ls_refresh ?? (body.refreshToken ? String(body.refreshToken) : undefined), { userAgent: request.headers['user-agent'], ipAddress: request.ip });
    reply.setCookie('ls_access', result.accessToken, { ...this.cookieOptions(), maxAge: 15 * 60 });
    reply.setCookie('ls_refresh', result.refreshToken, { ...this.cookieOptions(), maxAge: 30 * 24 * 60 * 60 });
    if (result.workspaceId) reply.setCookie('ls_workspace', result.workspaceId, { ...this.cookieOptions(), httpOnly: false, maxAge: 30 * 24 * 60 * 60 });
    return { accessToken: result.accessToken, workspaceId: result.workspaceId, user: result.user };
  }

  @Public()
  @Post('logout')
  async logout(@Req() request: FastifyRequest & { cookies?: Record<string, string> }, @Res({ passthrough: true }) reply: FastifyReply) {
    await this.sessions.end(request.cookies?.ls_refresh);
    for (const name of ['ls_access', 'ls_refresh', 'ls_workspace']) reply.clearCookie(name, this.cookieOptions());
    return { ok: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { id: true, email: true, displayName: true, memberships: { select: { role: true, workspace: { select: { id: true, name: true, slug: true, locale: true } } } } } });
  }

  private cookieOptions() { return { path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, domain: process.env.COOKIE_DOMAIN || undefined }; }
}
