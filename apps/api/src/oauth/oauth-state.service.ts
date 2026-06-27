import { BadRequestException, Injectable } from '@nestjs/common';
import { OAuthProvider, OAuthPurpose, Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { CryptoService } from '../crypto/crypto.service';

@Injectable()
export class OAuthStateService {
  constructor(private readonly prisma: PrismaService, private readonly crypto: CryptoService) {}

  async create(input: { provider: OAuthProvider; purpose: OAuthPurpose; workspaceId?: string; userId?: string; redirectUri: string; codeVerifier?: string; metadata?: Record<string, unknown> }) {
    const state = randomBytes(32).toString('base64url');
    const verifier = input.codeVerifier ? this.crypto.encrypt(input.codeVerifier) : undefined;
    await this.prisma.oAuthState.create({ data: { provider: input.provider, purpose: input.purpose, workspaceId: input.workspaceId, userId: input.userId, redirectUri: input.redirectUri, stateDigest: this.hash(state), encryptedCodeVerifier: verifier?.encrypted, codeVerifierIv: verifier?.iv, codeVerifierAuthTag: verifier?.authTag, metadata: input.metadata as Prisma.InputJsonValue | undefined, expiresAt: new Date(Date.now() + 10 * 60_000) } });
    return state;
  }

  async consume(state: string, provider: OAuthProvider, purpose: OAuthPurpose) {
    const row = await this.prisma.oAuthState.findUnique({ where: { stateDigest: this.hash(state) } });
    if (!row || row.provider !== provider || row.purpose !== purpose || row.consumedAt || row.expiresAt <= new Date()) throw new BadRequestException('OAuth state is invalid, expired, or already consumed');
    const claimed = await this.prisma.oAuthState.updateMany({ where: { id: row.id, consumedAt: null }, data: { consumedAt: new Date() } });
    if (claimed.count !== 1) throw new BadRequestException('OAuth state was already consumed');
    const codeVerifier = row.encryptedCodeVerifier && row.codeVerifierIv && row.codeVerifierAuthTag ? this.crypto.decrypt(row.encryptedCodeVerifier, row.codeVerifierIv, row.codeVerifierAuthTag) : undefined;
    return { ...row, codeVerifier };
  }

  createVerifier() {
    const verifier = randomBytes(48).toString('base64url');
    return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
  }

  private hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
}
