import assert from 'node:assert/strict';
import test from 'node:test';
import { LlmProvider } from '@prisma/client';
import { AnthropicStrategy } from '../../src/llm/anthropic.strategy';
import { GeminiStrategy } from '../../src/llm/gemini.strategy';
import { OpenAiCompatibleStrategy } from '../../src/llm/openai-compatible.strategy';

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

test('provider verification accepts a successful plain-text health response', async () => {
  const originalFetch = globalThis.fetch;

  try {
    let requestBody: any;
    globalThis.fetch = (async (_input, init) => {
      requestBody = JSON.parse(String(init?.body));
      return jsonResponse({
        candidates: [{ content: { parts: [{ text: 'OK' }] } }],
      });
    }) as typeof fetch;

    await new GeminiStrategy().verify(
      {
        id: 'gemini-test',
        provider: LlmProvider.GEMINI,
        credential: 'google-access-token',
        baseUrl:
          'https://us-central1-aiplatform.googleapis.com/v1/projects/test/locations/us-central1/publishers/google/models',
      },
      'gemini-2.5-flash',
    );

    assert.equal(
      requestBody.contents[0].parts[0].text,
      'Reply with exactly OK.',
    );
    assert.equal(requestBody.generationConfig.responseMimeType, undefined);

    globalThis.fetch = (async (_input, init) => {
      requestBody = JSON.parse(String(init?.body));
      return jsonResponse({ choices: [{ message: { content: 'OK' } }] });
    }) as typeof fetch;

    await new OpenAiCompatibleStrategy().verify(
      {
        id: 'openai-test',
        provider: LlmProvider.OPENAI,
        credential: 'openai-key',
      },
      'gpt-4o-mini',
    );

    assert.equal(requestBody.messages[0].content, 'Reply with exactly OK.');
    assert.equal(requestBody.response_format, undefined);

    globalThis.fetch = (async (_input, init) => {
      requestBody = JSON.parse(String(init?.body));
      return jsonResponse({ content: [{ type: 'text', text: 'OK' }] });
    }) as typeof fetch;

    await new AnthropicStrategy().verify(
      {
        id: 'anthropic-test',
        provider: LlmProvider.ANTHROPIC,
        credential: 'anthropic-key',
      },
      'claude-3-5-haiku-latest',
    );

    assert.equal(requestBody.messages[0].content, 'Reply with exactly OK.');
    assert.equal(requestBody.system, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
