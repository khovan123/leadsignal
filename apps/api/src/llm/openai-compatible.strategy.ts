import { Injectable } from '@nestjs/common';
import { LlmProvider } from '@prisma/client';
import type {
  LlmStrategy,
  StrategyConnection,
  StrategyRequest,
  StrategyResult,
} from './llm.types';
import {
  classificationSystemPrompt,
  fetchWithTimeout,
  mapHttp,
  parseBuyingSignal,
} from './strategy-utils';

const SUPPORTED_PROVIDERS = new Set<LlmProvider>([
  LlmProvider.OPENAI,
  LlmProvider.OPENROUTER,
  LlmProvider.GITHUB_MODELS,
  LlmProvider.CUSTOM_OPENAI_COMPATIBLE,
]);

@Injectable()
export class OpenAiCompatibleStrategy implements LlmStrategy {
  supports(provider: LlmProvider): boolean {
    return SUPPORTED_PROVIDERS.has(provider);
  }

  private base(connection: StrategyConnection): string {
    if (connection.baseUrl) return connection.baseUrl.replace(/\/$/, '');
    if (connection.provider === LlmProvider.OPENROUTER) {
      return 'https://openrouter.ai/api';
    }
    if (connection.provider === LlmProvider.GITHUB_MODELS) {
      return 'https://models.inference.ai.azure.com';
    }
    return 'https://api.openai.com';
  }

  async verify(
    connection: StrategyConnection,
    model = 'gpt-4o-mini',
  ): Promise<void> {
    await this.execute(connection, {
      model,
      title: 'Test',
      body: 'Looking for a CRM recommendation.',
      subreddit: 'test',
      timeoutMs: 20_000,
    });
  }

  async execute(
    connection: StrategyConnection,
    request: StrategyRequest,
  ): Promise<StrategyResult> {
    const started = Date.now();
    const response = await fetchWithTimeout(
      `${this.base(connection)}/v1/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${connection.credential}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          temperature: 0,
          messages: [
            { role: 'system', content: classificationSystemPrompt },
            {
              role: 'user',
              content: `Subreddit: ${request.subreddit}\nTitle: ${request.title}\nBody: ${request.body}`,
            },
          ],
          response_format: { type: 'json_object' },
        }),
      },
      request.timeoutMs,
    );

    if (!response.ok) mapHttp(response.status);
    const data = (await response.json()) as any;

    return {
      provider: connection.provider,
      model: data.model ?? request.model,
      output: parseBuyingSignal(data.choices?.[0]?.message?.content ?? ''),
      inputTokens: data.usage?.prompt_tokens,
      outputTokens: data.usage?.completion_tokens,
      latencyMs: Date.now() - started,
    };
  }
}
