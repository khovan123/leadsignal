export const INVITATION_PORT = Symbol('INVITATION_PORT');

export interface InvitationPort {
  create(
    workspaceId: string,
    invitedByUserId: string,
    input: { email?: string; role?: string },
  ): Promise<unknown>;
  accept(token: string | undefined, userId: string): Promise<unknown>;
}
