import { z } from 'zod';

export const buyingSignalSchema = z.object({
  isBuyingSignal: z.boolean(),
  signalType: z.string().min(1),
  confidence: z.number().min(0).max(1),
  buyingIntentScore: z.number().int().min(0).max(100),
  urgencyScore: z.number().int().min(0).max(100),
  fitScore: z.number().int().min(0).max(100),
  summary: z.string().min(1),
  evidence: z.array(z.object({ quote: z.string(), reason: z.string() })).default([]),
});

export type BuyingSignal = z.infer<typeof buyingSignalSchema>;

export const createConnectionSchema = z.object({
  provider: z.enum([
    'OPENAI', 'ANTHROPIC', 'GEMINI', 'OPENROUTER',
    'GITHUB_MODELS', 'CUSTOM_OPENAI_COMPATIBLE',
  ]),
  name: z.string().min(2).max(100),
  accountLabel: z.string().max(160).optional(),
  credential: z.string().min(1),
  baseUrl: z.string().url().optional(),
  ownerConcurrencyLimit: z.number().int().min(1).max(50).default(2),
  models: z.array(z.string().min(1)).min(1),
});

export type CreateConnectionInput = z.infer<typeof createConnectionSchema>;

export const leadStatusSchema = z.enum([
  'NEW', 'REVIEWING', 'QUALIFIED', 'ASSIGNED', 'CONTACTED', 'CONVERTED', 'REJECTED', 'ARCHIVED',
]);
