export const LLM_CONNECTIONS_PORT = Symbol('LLM_CONNECTIONS_PORT');

export interface LlmConnectionsPort {
  list(workspaceId: string): Promise<unknown>;
  create(workspaceId: string, ownerUserId: string, input: unknown): Promise<unknown>;
  verify(workspaceId: string, ownerUserId: string, id: string): Promise<unknown>;
  remove(workspaceId: string, ownerUserId: string, id: string): Promise<unknown>;
}
