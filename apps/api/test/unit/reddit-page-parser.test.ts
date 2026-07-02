import assert from 'node:assert/strict';
import test from 'node:test';
import type { Page } from 'playwright';
import { extractRedditCards } from '../../src/reddit-public/reddit-page-parser';

test('Reddit card evaluator executes a self-contained browser expression', async () => {
  let evaluator: string | undefined;
  const page = {
    evaluate: async (expression: string) => {
      evaluator = expression;
      return [];
    },
  } as unknown as Page;

  const cards = await extractRedditCards(page);

  assert.deepEqual(cards, []);
  assert.ok(evaluator);
  assert.doesNotMatch(evaluator, /__name/);
  assert.match(evaluator, /^\s*\(\(\)\s*=>/);
  assert.match(evaluator, /document\.querySelectorAll/);
  assert.match(evaluator, /\}\)\(\)\s*$/);
});

test('Reddit card evaluator rejects non-array results', async () => {
  const page = {
    evaluate: async () => ({ unexpected: true }),
  } as unknown as Page;

  await assert.rejects(
    () => extractRedditCards(page),
    /did not return a card array/,
  );
});
