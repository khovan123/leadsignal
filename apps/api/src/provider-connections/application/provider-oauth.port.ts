export const PROVIDER_OAUTH_PORT = Symbol('PROVIDER_OAUTH_PORT');

export interface ProviderOAuthPort {
  start(
    provider: string,
    workspaceId: string,
    userId: string,
  ): Promise<unknown>;
  complete(
    provider: string,
    code: string | undefined,
    state: string | undefined,
  ): Promise<{ provider: string }>;
}
