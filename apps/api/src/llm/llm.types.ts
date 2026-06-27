import type { BuyingSignal } from '@leadsignal/contracts';
import type { LlmProvider } from '@prisma/client';

export interface StrategyConnection {
  id: string;
  provider: LlmProvider;
  credential?: string;
  baseUrl?: string | null;
}

export interface StrategyRequest {
  model: string;
  title: string;
  body: string;
  subreddit: string;
  timeoutMs: number;
}

export interface StrategyResult {
  provider: LlmProvider;
  model: string;
  output: BuyingSignal;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
}

export interface LlmStrategy {
  supports(provider: LlmProvider): boolean;
  verify(connection: StrategyConnection, model?: string): Promise<void>;
  execute(connection: StrategyConnection, request: StrategyRequest): Promise<StrategyResult>;
}

export class StrategyError extends Error {
  constructor(message: string, public readonly code: string, public readonly retryable: boolean, public readonly fallbackable: boolean) { super(message); }
}
