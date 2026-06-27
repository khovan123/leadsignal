import { BadRequestException, Injectable } from '@nestjs/common';
import { OAuthProvider, OAuthPurpose } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { SessionService, type SessionContext } from '../auth/session.service';
import { OAuthStateService } from './oauth-state.service';
import { OAuthBrokerService } from './oauth-broker.service';
import { ProviderProfileService } from './provider-profile.service';

@Injectable()
export class ApplicationOAuthService {
  constructor(private readonly prisma: PrismaService, private readonly states: OAuthStateService, private readonly broker: OAuthBrokerService, private readonly profiles: ProviderProfileService, private readonly sessions: SessionService) {}

  async start(provider: string, returnTo = '/', locale = 'vi') {
    const oauthProvider = this.providerEnum(provider);
    const verifier = this.states.createVerifier();
    const redirectUri = this.broker.config(provider).redirectUri;
    const state = await this.states.create({ provider: oauthProvider, purpose: OAuthPurpose.APPLICATION_LOGIN, redirectUri, codeVerifier: verifier.verifier, metadata: { provider, returnTo, locale } });
    return { authorizationUrl: this.broker.authorizationUrl(provider, state, verifier.verifier).toString() };
  }

  async callback(provider: string, query: Record<string, unknown>, context: SessionContext) {
    if (query.error) throw new BadRequestException(`OAuth failed: ${String(query.error)}`);
    const state = await this.states.consume(String(query.state ?? ''), this.providerEnum(provider), OAuthPurpose.APPLICATION_LOGIN);
    const tokens = await this.broker.exchange(provider, String(query.code ?? ''), state.codeVerifier ?? '');
    const identity = await this.profiles.applicationIdentity(provider, tokens.accessToken());
    const user = await this.prisma.user.upsert({ where: { email: identity.email }, update: { displayName: identity.name }, create: { email: identity.email, displayName: identity.name } });
    let membership = await this.prisma.workspaceMember.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } });
    if (!membership) {
      const slugBase = identity.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'workspace';
      const workspace = await this.prisma.workspace.create({ data: { name: `${identity.name}'s workspace`, slug: `${slugBase}-${randomUUID().slice(0, 8)}` } });
      membership = await this.prisma.workspaceMember.create({ data: { workspaceId: workspace.id, userId: user.id, role: 'OWNER' } });
    }
    const session = await this.sessions.start(user, membership.workspaceId, context);
    return { ...session, redirectUrl: this.redirect(state.metadata) };
  }

  private providerEnum(provider: string) {
    if (provider === 'github') return OAuthProvider.GITHUB;
    if (provider === 'google') return OAuthProvider.GEMINI;
    throw new BadRequestException('Supported sign-in providers are github and google');
  }

  private redirect(metadata: unknown) {
    const item = metadata && typeof metadata === 'object' ? metadata as Record<string, unknown> : {};
    const locale = typeof item.locale === 'string' ? item.locale : 'vi';
    const returnTo = typeof item.returnTo === 'string' && item.returnTo.startsWith('/') ? item.returnTo : `/${locale}`;
    return `${process.env.APP_URL ?? 'http://localhost:3000'}${returnTo}`;
  }
}
