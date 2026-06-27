import { Injectable } from '@nestjs/common';
import { LlmProvider } from '@prisma/client';
import type { LlmStrategy, StrategyConnection, StrategyRequest, StrategyResult } from './llm.types';
import { classificationSystemPrompt, fetchWithTimeout, mapHttp, parseBuyingSignal } from './strategy-utils';

@Injectable()
export class GeminiStrategy implements LlmStrategy {
  supports(provider: LlmProvider) { return provider === LlmProvider.GEMINI; }
  async verify(connection: StrategyConnection, model = 'gemini-2.0-flash') {
    await this.execute(connection, { model, title: 'Test', body: 'Looking for a CRM recommendation.', subreddit: 'test', timeoutMs: 20_000 });
  }
  async execute(connection: StrategyConnection, request: StrategyRequest): Promise<StrategyResult> {
    const started = Date.now();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(request.model)}:generateContent?key=${encodeURIComponent(connection.credential ?? '')}`;
    const response = await fetchWithTimeout(url, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ generationConfig: { temperature: 0, responseMimeType: 'application/json' }, contents: [{ role: 'user', parts: [{ text: `${classificationSystemPrompt}\n\nSubreddit: ${request.subreddit}\nTitle: ${request.title}\nBody: ${request.body}` }] }] }),
    }, request.timeoutMs);
    if (!response.ok) mapHttp(response.status);
    const data = await response.json() as any;
    const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? '';
    return { provider: LlmProvider.GEMINI, model: request.model, output: parseBuyingSignal(text), inputTokens: data.usageMetadata?.promptTokenCount, outputTokens: data.usageMetadata?.candidatesTokenCount, latencyMs: Date.now() - started };
  }
}
