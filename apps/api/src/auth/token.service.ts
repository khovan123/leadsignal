import { Injectable, UnauthorizedException } from '@nestjs/common';
import { SignJWT, jwtVerify } from 'jose';
import { createHash, randomUUID } from 'node:crypto';
import { nanoid } from 'nanoid';
import { SecretsService } from '../secrets/secrets.service';
import type { AuthenticatedUser } from './decorators';

@Injectable()
export class TokenService {
  constructor(private readonly secrets: SecretsService) {}
  private signingKey(): Uint8Array { return new TextEncoder().encode(this.secrets.require('JWT_ACCESS_SECRET', 32)); }
  async issueAccess(user: { id: string; email: string }, sessionId: string): Promise<string> {
    return new SignJWT({ email: user.email, sid: sessionId }).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setSubject(user.id).setIssuer(process.env.JWT_ISSUER ?? 'leadsignal-api').setAudience(process.env.JWT_AUDIENCE ?? 'leadsignal-web').setIssuedAt().setExpirationTime(process.env.JWT_ACCESS_TTL ?? '15m').sign(this.signingKey());
  }
  async verifyAccess(value: string): Promise<AuthenticatedUser> {
    try {
      const { payload } = await jwtVerify(value, this.signingKey(), { issuer: process.env.JWT_ISSUER ?? 'leadsignal-api', audience: process.env.JWT_AUDIENCE ?? 'leadsignal-web' });
      if (!payload.sub || typeof payload.email !== 'string' || typeof payload.sid !== 'string') throw new Error('Invalid claims');
      return { id: payload.sub, email: payload.email, sessionId: payload.sid };
    } catch { throw new UnauthorizedException('Access token is invalid or expired'); }
  }
  createRefreshToken(sessionId = randomUUID()) { const token = `${sessionId}.${nanoid(64)}`; return { sessionId, token, hash: this.hash(token) }; }
  hash(value: string): string { return createHash('sha256').update(value).digest('hex'); }
}
