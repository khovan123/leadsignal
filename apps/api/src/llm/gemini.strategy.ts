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

@Injectable()
export class GeminiStrategy implements LlmStrategy {
  supports(provider: LlmProvider) {
    return provider === LlmProvider.GEMINI;
  }

  async verify(
    connection: StrategyConnection,
    model = 'gemini-2.5-flash',
  ) {
    const response = await this.sendGenerateContent(
      connection,
      model,
      {
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 16,
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Reply with exactly OK.' }],
          },
        ],
      },
      20_000,
    );

    if (!response.ok) mapHttp(response.status);
  }

  async execute(
    connection: StrategyConnection,
    request: StrategyRequest,
  ): Promise<StrategyResult> {
    const started = Date.now();
    const response = await this.sendGenerateContent(
      connection,
      request.model,
      {
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `${classificationSystemPrompt}\n\nSubreddit: ${request.subreddit}\nTitle: ${request.title}\nBody: ${request.body}`,
              },
            ],
          },
        ],
      },
      request.timeoutMs,
    );

    if (!response.ok) mapHttp(response.status);
    const data = (await response.json()) as any;
    const text =
      data.candidates?.[0]?.content?.parts
        ?.map((part: any) => part.text ?? '')
        .join('') ?? '';

    return {
      provider: LlmProvider.GEMINI,
      model: request.model,
      output: parseBuyingSignal(text),
      inputTokens: data.usageMetadata?.promptTokenCount,
      outputTokens: data.usageMetadata?.candidatesTokenCount,
      latencyMs: Date.now() - started,
    };
  }

  private sendGenerateContent(
    connection: StrategyConnection,
    model: string,
    body: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<Response> {
    const oauth =
      connection.baseUrl === 'vertex-oauth://google' ||
      Boolean(connection.baseUrl?.includes('aiplatform.googleapis.com'));
    const baseUrl = oauth ? resolveVertexBaseUrl(connection.baseUrl) : undefined;
    const url = oauth
      ? `${baseUrl}/${encodeURIComponent(model)}:generateContent`
      : `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(connection.credential ?? '')}`;

    return fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(oauth
            ? { Authorization: `Bearer ${connection.credential ?? ''}` }
            : {}),
        },
        body: JSON.stringify(body),
      },
      timeoutMs,
    );
  }
}

function resolveVertexBaseUrl(configured?: string) {
  if (configured && configured !== 'vertex-oauth://google') {
    return configured.replace(/\/$/, '');
  }
  const project = process.env.GOOGLE_VERTEX_PROJECT_ID;
  if (!project) {
    throw new Error('GOOGLE_VERTEX_PROJECT_ID is required for Google OAuth');
  }
  const location = process.env.GOOGLE_VERTEX_LOCATION ?? 'us-central1';
  return `https://${location}-aiplatform.googleapis.com/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/publishers/google/models`;
}
