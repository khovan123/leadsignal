import { Module } from '@nestjs/common';
import { LlmController } from './llm.controller';
import { LlmService } from './llm.service';
import { LlmPoolRouterService } from './llm-pool-router.service';
import { SlotManagerService } from './slot-manager.service';
import { OpenAiCompatibleStrategy } from './openai-compatible.strategy';
import { AnthropicStrategy } from './anthropic.strategy';
import { GeminiStrategy } from './gemini.strategy';
import { RuleEngineStrategy } from './rule-engine.strategy';

@Module({
  controllers: [LlmController],
  providers: [LlmService, LlmPoolRouterService, SlotManagerService, OpenAiCompatibleStrategy, AnthropicStrategy, GeminiStrategy, RuleEngineStrategy],
  exports: [LlmPoolRouterService],
})
export class LlmModule {}
