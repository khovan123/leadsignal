export const WORKSPACE_REPOSITORY = Symbol('WORKSPACE_REPOSITORY');

export interface WorkspaceDetails {
  id: string;
  name: string;
  slug: string;
  locale: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    members: number;
    leads: number;
    llmConnections: number;
  };
}

export interface WorkspaceRepository {
  findDetails(id: string): Promise<WorkspaceDetails | null>;
}
