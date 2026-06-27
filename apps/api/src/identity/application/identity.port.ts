export const IDENTITY_PORT = Symbol('IDENTITY_PORT');

export interface RequestMetadata {
  userAgent?: string;
  ip?: string;
}

export interface RegisterInput {
  email?: string;
  displayName?: string;
  password?: string;
}

export interface LoginInput {
  email?: string;
  password?: string;
}

export interface IdentityPort {
  register(input: RegisterInput, metadata: RequestMetadata): Promise<unknown>;
  login(input: LoginInput, metadata: RequestMetadata): Promise<unknown>;
  refresh(
    refreshToken: string | undefined,
    metadata: RequestMetadata,
  ): Promise<unknown>;
  logout(userId: string, sessionId: string): Promise<unknown>;
}
