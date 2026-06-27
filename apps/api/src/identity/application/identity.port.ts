export const IDENTITY_PORT = Symbol('IDENTITY_PORT');
export interface IdentityPort {
  register(input: unknown, metadata: unknown): Promise<unknown>;
  login(input: unknown, metadata: unknown): Promise<unknown>;
  refresh(token: string | undefined, metadata: unknown): Promise<unknown>;
  logout(userId: string, sessionId: string): Promise<unknown>;
}
