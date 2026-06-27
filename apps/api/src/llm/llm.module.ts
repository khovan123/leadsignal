import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
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
import { LlmController } from './presentation/llm.controller';
import { RuleEngineStrategy } from './rule-engine.strategy';
import { SlotManagerService } from './slot-manager.service';

@Module({
  imports: [CqrsModule],
  controllers: [LlmController],
  providers: [
    ...LLM_CONNECTION_COMMAND_HANDLERS,
    ...LLM_CONNECTION_QUERY_HANDLERS,
    LlmService,
    LlmConnectionsAdapter,
    { provide: LLM_CONNECTIONS_PORT, useExisting: LlmConnectionsAdapter },
    LlmPoolRouterService,
    SlotManagerService,
    OpenAiCompatibleStrategy,
    AnthropicStrategy,
    GeminiStrategy,
    RuleEngineStrategy,
  ],
  exports: [LlmPoolRouterService],
})
export class LlmModule {}
