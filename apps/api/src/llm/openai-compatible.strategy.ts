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
    if (connection.baseUrl) return connection.baseUrl.replace(/\/+$/, '');
    if (connection.provider === LlmProvider.OPENROUTER) {
      return 'https://openrouter.ai/api';
    }
    if (connection.provider === LlmProvider.GITHUB_MODELS) {
      return 'https://models.inference.ai.azure.com';
    }
    return 'https://api.openai.com';
  }

  private endpoint(connection: StrategyConnection, resource: string): string {
    const base = this.base(connection);
    const normalizedResource = resource.replace(/^\/+/, '');
    return /\/v1$/i.test(base)
      ? `${base}/${normalizedResource}`
      : `${base}/v1/${normalizedResource}`;
  }

  async verify(
    connection: StrategyConnection,
    model = 'gpt-4o-mini',
  ): Promise<void> {
    if (this.isNineRouter(connection)) {
      await this.verifyNineRouter(connection, model);
    }

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
    const commonBody = {
      model: request.model,
      temperature: 0,
      messages: [
        { role: 'system', content: classificationSystemPrompt },
        {
          role: 'user',
          content: `Subreddit: ${request.subreddit}\nTitle: ${request.title}\nBody: ${request.body}`,
        },
      ],
    };

    let response = await this.sendCompletion(
      connection,
      { ...commonBody, response_format: { type: 'json_object' } },
      request.timeoutMs,
    );

    // Some subscription-backed routes translate OpenAI requests to a
    // provider that does not expose response_format. Retry once without it.
    if ([400, 422].includes(response.status) && this.isNineRouter(connection)) {
      response = await this.sendCompletion(
        connection,
        commonBody,
        request.timeoutMs,
      );
    }

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

  private sendCompletion(
    connection: StrategyConnection,
    body: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<Response> {
    return fetchWithTimeout(
      this.endpoint(connection, 'chat/completions'),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${connection.credential}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      timeoutMs,
    );
  }

  private async verifyNineRouter(
    connection: StrategyConnection,
    model: string,
  ): Promise<void> {
    const response = await fetchWithTimeout(
      this.endpoint(connection, 'models'),
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${connection.credential}`,
        },
      },
      10_000,
    );

    if (!response.ok) mapHttp(response.status);
    const payload = (await response.json()) as {
      data?: Array<{ id?: string }>;
    };
    const modelIds = payload.data
      ?.map((item) => item.id)
      .filter((id): id is string => Boolean(id));

    if (modelIds?.length && !modelIds.includes(model)) {
      throw new Error(`9ROUTER_MODEL_NOT_FOUND:${model}`);
    }
  }

  private isNineRouter(connection: StrategyConnection): boolean {
    if (!connection.baseUrl) return false;
    try {
      const url = new URL(connection.baseUrl);
      return url.port === '20128' || /9router/i.test(url.hostname);
    } catch {
      return /9router|20128/i.test(connection.baseUrl);
    }
  }
}
