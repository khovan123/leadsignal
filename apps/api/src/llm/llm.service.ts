import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createConnectionSchema } from '@leadsignal/contracts';
import { ConnectionStatus, LlmProvider } from '@prisma/client';
import { CryptoService } from '../crypto/crypto.service';
import { PrismaService } from '../database/prisma.service';
import { ProductionService } from '../production/production.service';
import { AnthropicStrategy } from './anthropic.strategy';
import { GeminiStrategy } from './gemini.strategy';
import { StrategyError } from './llm.types';
import { OpenAiCompatibleStrategy } from './openai-compatible.strategy';

@Injectable()
export class LlmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly production: ProductionService,
    private readonly openAi: OpenAiCompatibleStrategy,
    private readonly anthropic: AnthropicStrategy,
    private readonly gemini: GeminiStrategy,
  ) {}

  async list(workspaceId: string) {
    await this.syncRoutes(workspaceId);
    return this.prisma.llmConnection.findMany({
      where: { workspaceId, deletedAt: null },
      select: {
        id: true,
        ownerUserId: true,
        provider: true,
        name: true,
        accountLabel: true,
        status: true,
        poolEnabled: true,
        ownerConcurrencyLimit: true,
        healthScore: true,
        lastVerifiedAt: true,
        lastUsedAt: true,
        models: true,
      },
    });
  }

  async create(workspaceId: string, ownerUserId: string, body: unknown) {
    const input = createConnectionSchema.parse(body);
    const encrypted = this.crypto.encrypt(input.credential);
    const connection = await this.prisma.llmConnection.create({
      data: {
        workspaceId,
        ownerUserId,
        provider: input.provider,
        name: input.name,
        accountLabel: input.accountLabel,
        baseUrl: input.baseUrl,
        ownerConcurrencyLimit: input.ownerConcurrencyLimit,
        status: ConnectionStatus.PENDING,
        encryptedCredential: encrypted.encrypted,
        credentialIv: encrypted.iv,
        credentialAuthTag: encrypted.authTag,
        models: { create: input.models.map((model) => ({ model })) },
      },
      include: { models: true },
    });

    await this.syncRoutes(workspaceId);
    return {
      id: connection.id,
      provider: connection.provider,
      name: connection.name,
      accountLabel: connection.accountLabel,
      status: connection.status,
      models: connection.models,
    };
  }

  async syncRoutes(workspaceId: string) {
    let policy = await this.prisma.llmRoutingPolicy.findFirst({
      where: {
        workspaceId,
        taskType: 'BUYING_SIGNAL_CLASSIFICATION',
        enabled: true,
      },
      orderBy: { version: 'desc' },
      include: { routes: true },
    });
    if (!policy) {
      policy = await this.prisma.llmRoutingPolicy.create({
        data: {
          workspaceId,
          taskType: 'BUYING_SIGNAL_CLASSIFICATION',
          version: 1,
        },
        include: { routes: true },
      });
    }

    const connections = await this.prisma.llmConnection.findMany({
      where: { workspaceId, deletedAt: null, poolEnabled: true },
      include: { models: { where: { enabled: true } } },
    });
    let nextTier =
      Math.max(
        0,
        ...policy.routes
          .filter((route) => route.tier < 999)
          .map((route) => route.tier),
      ) + 1;

    for (const connection of connections) {
      for (const model of connection.models) {
        const exists = await this.prisma.llmModelRoute.findFirst({
          where: {
            policyId: policy.id,
            provider: connection.provider,
            model: model.model,
          },
        });
        if (!exists) {
          await this.prisma.llmModelRoute.create({
            data: {
              policyId: policy.id,
              tier: nextTier++,
              provider: connection.provider,
              model: model.model,
            },
          });
        }
      }
    }

    const rule = await this.prisma.llmModelRoute.findFirst({
      where: { policyId: policy.id, provider: LlmProvider.RULE_ENGINE },
    });
    if (!rule) {
      await this.prisma.llmModelRoute.create({
        data: {
          policyId: policy.id,
          tier: 999,
          provider: LlmProvider.RULE_ENGINE,
          model: 'deterministic-buying-signal-v1',
          maxRetries: 0,
          timeoutMs: 5000,
        },
      });
    }

    return { success: true };
  }

  async remove(workspaceId: string, ownerUserId: string, id: string) {
    const connection = await this.prisma.llmConnection.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });
    if (!connection) throw new NotFoundException('Connection not found');
    if (connection.ownerUserId !== ownerUserId) {
      throw new ForbiddenException('Only the owner can remove this connection');
    }
    return this.prisma.llmConnection.update({
      where: { id },
      data: {
        status: ConnectionStatus.DRAINING,
        poolEnabled: false,
        deletedAt: new Date(),
        encryptedCredential: null,
        credentialIv: null,
        credentialAuthTag: null,
      },
    });
  }

  async verify(workspaceId: string, actorUserId: string, id: string) {
    const connection = await this.prisma.llmConnection.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: { models: true },
    });
    if (!connection) throw new NotFoundException('Connection not found');

    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: actorUserId,
        },
      },
      select: { id: true },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    const oauthCredential = await this.production.getFreshProviderCredential(
      connection.id,
    );
    const credential =
      oauthCredential ??
      (connection.encryptedCredential &&
      connection.credentialIv &&
      connection.credentialAuthTag
        ? this.crypto.decrypt(
            connection.encryptedCredential,
            connection.credentialIv,
            connection.credentialAuthTag,
          )
        : undefined);

    const strategy = this.openAi.supports(connection.provider)
      ? this.openAi
      : this.anthropic.supports(connection.provider)
        ? this.anthropic
        : this.gemini;

    try {
      await strategy.verify(
        {
          id: connection.id,
          provider: connection.provider,
          credential,
          baseUrl: connection.baseUrl,
        },
        connection.models[0]?.model,
      );
      return this.prisma.llmConnection.update({
        where: { id },
        data: {
          status: ConnectionStatus.ACTIVE,
          lastVerifiedAt: new Date(),
          lastErrorCode: null,
        },
      });
    } catch (error) {
      await this.prisma.llmConnection.update({
        where: { id },
        data: {
          status: ConnectionStatus.INVALID,
          lastErrorCode:
            error instanceof StrategyError
              ? error.code
              : error instanceof Error
                ? error.message.slice(0, 100)
                : 'VERIFY_FAILED',
        },
      });

      if (error instanceof StrategyError) {
        throw new BadGatewayException({
          message: error.message,
          code: error.code,
        });
      }
      throw error;
    }
  }
}
