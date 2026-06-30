import assert from 'node:assert/strict';
import test from 'node:test';
import type { Page } from 'playwright';
import { extractRedditCards } from '../../src/reddit-public/reddit-page-parser';

test('Reddit card evaluator does not depend on tsx runtime helpers', async () => {
  let evaluator: ((elements: Element[]) => unknown) | undefined;
  const page = {
    locator: () => ({
      evaluateAll: async (callback: (elements: Element[]) => unknown) => {
        evaluator = callback;
        return [];
      },
    }),
  } as unknown as Page;

  await extractRedditCards(page);

  assert.ok(evaluator);
  assert.doesNotMatch(evaluator.toString(), /__name/);
  assert.match(evaluator.toString(), /function anonymous/);
});
