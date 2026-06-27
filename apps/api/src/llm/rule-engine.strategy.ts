import { Injectable } from '@nestjs/common';
import { LlmProvider } from '@prisma/client';
import type { LlmStrategy, StrategyConnection, StrategyRequest, StrategyResult } from './llm.types';

@Injectable()
export class RuleEngineStrategy implements LlmStrategy {
  supports(provider: LlmProvider) { return provider === LlmProvider.RULE_ENGINE; }
  async verify() { return; }
  async execute(_connection: StrategyConnection, request: StrategyRequest): Promise<StrategyResult> {
    const text = `${request.title} ${request.body}`.toLowerCase();
    const positive = ['looking for', 'recommend', 'alternative to', 'need a tool', 'need software', 'budget', 'switching from', 'solution'];
    const matches = positive.filter((keyword) => text.includes(keyword));
    const score = Math.min(90, 35 + matches.length * 18);
    return {
      provider: LlmProvider.RULE_ENGINE,
      model: 'deterministic-buying-signal-v1',
      output: {
        isBuyingSignal: matches.length > 0,
        signalType: matches.length ? 'LOOKING_FOR_SOLUTION' : 'NOT_A_BUYING_SIGNAL',
        confidence: matches.length ? 0.6 : 0.5,
        buyingIntentScore: score,
        urgencyScore: text.includes('urgent') || text.includes('asap') ? 80 : 45,
        fitScore: 60,
        summary: matches.length ? `Matched buying-intent phrases: ${matches.join(', ')}` : 'No deterministic buying-intent phrase matched.',
        evidence: matches.map((quote) => ({ quote, reason: 'Matched deterministic buying-intent rule' })),
      },
      latencyMs: 1,
    };
  }
}
