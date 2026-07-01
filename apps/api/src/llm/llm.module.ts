import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CryptoService } from '../crypto/crypto.service';
import { PrismaService } from '../database/prisma.service';
import { ProductionService } from '../production/production.service';
import { LLM_CONNECTIONS_PORT } from './application/llm-connections.port';
import {
  LLM_CONNECTION_COMMAND_HANDLERS,
  LLM_CONNECTION_QUERY_HANDLERS,
} from './application/llm-connections.use-cases';
import { AnthropicStrategy } from './anthropic.strategy';
import { GeminiStrategy } from './gemini.strategy';
import { LlmConnectionsAdapter } from './infrastructure/llm-connections.adapter';
import { LlmPoolRouterService } from './llm-pool-router.service';
import { LlmService } from './llm.service';
import { OpenAiCompatibleStrategy } from './openai-compatible.strategy';
import { LlmHttpController } from './presentation/cqrs.controller';
import { RuleEngineStrategy } from './rule-engine.strategy';
import { SlotManagerService } from './slot-manager.service';

@Module({
  imports: [CqrsModule],
  controllers: [LlmHttpController],
  providers: [
    ...LLM_CONNECTION_COMMAND_HANDLERS,
    ...LLM_CONNECTION_QUERY_HANDLERS,
    SlotManagerService,
    OpenAiCompatibleStrategy,
    AnthropicStrategy,
    GeminiStrategy,
    RuleEngineStrategy,
    {
      provide: LlmService,
      useFactory: (
        prisma: PrismaService,
        crypto: CryptoService,
        production: ProductionService,
        openAi: OpenAiCompatibleStrategy,
        anthropic: AnthropicStrategy,
        gemini: GeminiStrategy,
      ) =>
        new LlmService(
          prisma,
          crypto,
          production,
          openAi,
          anthropic,
          gemini,
        ),
      inject: [
        PrismaService,
        CryptoService,
        ProductionService,
        OpenAiCompatibleStrategy,
        AnthropicStrategy,
        GeminiStrategy,
      ],
    },
    LlmConnectionsAdapter,
    { provide: LLM_CONNECTIONS_PORT, useExisting: LlmConnectionsAdapter },
    {
      provide: LlmPoolRouterService,
      useFactory: (
        prisma: PrismaService,
        crypto: CryptoService,
        slots: SlotManagerService,
        production: ProductionService,
        openAi: OpenAiCompatibleStrategy,
        anthropic: AnthropicStrategy,
        gemini: GeminiStrategy,
        ruleEngine: RuleEngineStrategy,
      ) =>
        new LlmPoolRouterService(
          prisma,
          crypto,
          slots,
          production,
          openAi,
          anthropic,
          gemini,
          ruleEngine,
        ),
      inject: [
        PrismaService,
        CryptoService,
        SlotManagerService,
        ProductionService,
        OpenAiCompatibleStrategy,
        AnthropicStrategy,
        GeminiStrategy,
        RuleEngineStrategy,
      ],
    },
  ],
  exports: [LlmPoolRouterService],
})
export class LlmModule {}
