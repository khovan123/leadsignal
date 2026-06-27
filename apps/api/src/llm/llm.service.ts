import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createConnectionSchema } from '@leadsignal/contracts';
import { ConnectionStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { OpenAiCompatibleStrategy } from './openai-compatible.strategy';
import { AnthropicStrategy } from './anthropic.strategy';
import { GeminiStrategy } from './gemini.strategy';

@Injectable()
export class LlmService {
  constructor(private readonly prisma: PrismaService, private readonly crypto: CryptoService, private readonly openAi: OpenAiCompatibleStrategy, private readonly anthropic: AnthropicStrategy, private readonly gemini: GeminiStrategy) {}

  list(workspaceId: string) {
    return this.prisma.llmConnection.findMany({ where: { workspaceId, deletedAt: null }, select: { id: true, ownerUserId: true, provider: true, name: true, accountLabel: true, status: true, poolEnabled: true, ownerConcurrencyLimit: true, healthScore: true, lastVerifiedAt: true, lastUsedAt: true, models: true } });
  }

  async create(workspaceId: string, ownerUserId: string, body: unknown) {
    const input = createConnectionSchema.parse(body);
    const encrypted = this.crypto.encrypt(input.credential);
    const connection = await this.prisma.llmConnection.create({ data: {
      workspaceId, ownerUserId, provider: input.provider, name: input.name, accountLabel: input.accountLabel,
      baseUrl: input.baseUrl, ownerConcurrencyLimit: input.ownerConcurrencyLimit, status: ConnectionStatus.PENDING,
      encryptedCredential: encrypted.encrypted, credentialIv: encrypted.iv, credentialAuthTag: encrypted.authTag,
      models: { create: input.models.map((model) => ({ model })) },
    }, include: { models: true } });

    let policy = await this.prisma.llmRoutingPolicy.findFirst({
      where: { workspaceId, taskType: 'BUYING_SIGNAL_CLASSIFICATION', enabled: true },
      orderBy: { version: 'desc' }, include: { routes: true },
    });
    if (!policy) {
      policy = await this.prisma.llmRoutingPolicy.create({
        data: { workspaceId, taskType: 'BUYING_SIGNAL_CLASSIFICATION', version: 1 }, include: { routes: true },
      });
    }
    for (const model of input.models) {
      const exists = await this.prisma.llmModelRoute.findFirst({ where: { policyId: policy.id, provider: input.provider, model } });
      if (!exists) {
        const tiers = policy.routes.filter((route) => route.tier < 999).map((route) => route.tier);
        const tier = (tiers.length ? Math.max(...tiers) : 0) + 1;
        const route = await this.prisma.llmModelRoute.create({ data: { policyId: policy.id, tier, provider: input.provider, model } });
        policy.routes.push(route);
      }
    }
    const rule = await this.prisma.llmModelRoute.findFirst({ where: { policyId: policy.id, provider: 'RULE_ENGINE' } });
    if (!rule) await this.prisma.llmModelRoute.create({ data: { policyId: policy.id, tier: 999, provider: 'RULE_ENGINE', model: 'deterministic-buying-signal-v1', maxRetries: 0, timeoutMs: 5000 } });
    return { id: connection.id, provider: connection.provider, name: connection.name, accountLabel: connection.accountLabel, status: connection.status, models: connection.models };
  }

  async remove(workspaceId: string, ownerUserId: string, id: string) {
    const connection = await this.prisma.llmConnection.findFirst({ where: { id, workspaceId, deletedAt: null } });
    if (!connection) throw new NotFoundException('Connection not found');
    if (connection.ownerUserId !== ownerUserId) throw new ForbiddenException('Only the owner can remove this connection');
    return this.prisma.llmConnection.update({ where: { id }, data: { status: ConnectionStatus.DRAINING, poolEnabled: false, deletedAt: new Date(), encryptedCredential: null, credentialIv: null, credentialAuthTag: null } });
  }

  async verify(workspaceId: string, ownerUserId: string, id: string) {
    const connection = await this.prisma.llmConnection.findFirst({ where: { id, workspaceId, ownerUserId, deletedAt: null }, include: { models: true } });
    if (!connection) throw new NotFoundException('Connection not found');
    const credential = connection.encryptedCredential && connection.credentialIv && connection.credentialAuthTag ? this.crypto.decrypt(connection.encryptedCredential, connection.credentialIv, connection.credentialAuthTag) : undefined;
    const strategy = this.openAi.supports(connection.provider) ? this.openAi : this.anthropic.supports(connection.provider) ? this.anthropic : this.gemini;
    try {
      await strategy.verify({ id: connection.id, provider: connection.provider, credential, baseUrl: connection.baseUrl }, connection.models[0]?.model);
      return this.prisma.llmConnection.update({ where: { id }, data: { status: ConnectionStatus.ACTIVE, lastVerifiedAt: new Date(), lastErrorCode: null } });
    } catch (error) {
      await this.prisma.llmConnection.update({ where: { id }, data: { status: ConnectionStatus.INVALID, lastErrorCode: error instanceof Error ? error.message.slice(0, 100) : 'VERIFY_FAILED' } });
      throw error;
    }
  }
}
