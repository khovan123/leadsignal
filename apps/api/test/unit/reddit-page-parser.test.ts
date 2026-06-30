import assert from 'node:assert/strict';
import test from 'node:test';
import type { Page } from 'playwright';
import { extractRedditCards } from '../../src/reddit-public/reddit-page-parser';

test('Reddit card evaluator is a self-contained string expression', async () => {
  let evaluator: string | undefined;
  const page = {
    locator: () => ({
      evaluateAll: async (expression: string) => {
        evaluator = expression;
        return [];
      },
    }),
  } as unknown as Page;

  await extractRedditCards(page);

  assert.ok(evaluator);
  assert.doesNotMatch(evaluator, /__name/);
  assert.match(evaluator, /^\s*\(elements\)\s*=>/);
});
