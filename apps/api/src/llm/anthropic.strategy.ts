import { Injectable } from '@nestjs/common';
import { LlmProvider } from '@prisma/client';
import type { LlmStrategy, StrategyConnection, StrategyRequest, StrategyResult } from './llm.types';
import { classificationSystemPrompt, fetchWithTimeout, mapHttp, parseBuyingSignal } from './strategy-utils';

@Injectable()
export class AnthropicStrategy implements LlmStrategy {
  supports(provider: LlmProvider) { return provider === LlmProvider.ANTHROPIC; }
  async verify(connection: StrategyConnection, model = 'claude-3-5-haiku-latest') {
    await this.execute(connection, { model, title: 'Test', body: 'Looking for a CRM recommendation.', subreddit: 'test', timeoutMs: 20_000 });
  }
  async execute(connection: StrategyConnection, request: StrategyRequest): Promise<StrategyResult> {
    const started = Date.now();
    const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': connection.credential ?? '', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: request.model, max_tokens: 1200, temperature: 0, system: classificationSystemPrompt, messages: [{ role: 'user', content: `Subreddit: ${request.subreddit}\nTitle: ${request.title}\nBody: ${request.body}` }] }),
    }, request.timeoutMs);
    if (!response.ok) mapHttp(response.status);
    const data = await response.json() as any;
    return { provider: LlmProvider.ANTHROPIC, model: data.model ?? request.model, output: parseBuyingSignal(data.content?.find((x: any) => x.type === 'text')?.text ?? ''), inputTokens: data.usage?.input_tokens, outputTokens: data.usage?.output_tokens, latencyMs: Date.now() - started };
  }
}
