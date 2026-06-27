import type { LeadStatusValue } from './lead-status.value-object';

export const LEAD_REPOSITORY = Symbol('LEAD_REPOSITORY');

export interface LeadRecord {
  id: string;
  workspaceId: string;
  postId: string;
  classificationId: string;
  status: LeadStatusValue;
  priorityScore: number;
  priorityLevel: string;
  assignedToUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  post?: unknown;
  classification?: unknown;
}

export interface LeadRepository {
  listByWorkspace(workspaceId: string): Promise<LeadRecord[]>;
  exists(workspaceId: string, leadId: string): Promise<boolean>;
  updateStatus(
    workspaceId: string,
    leadId: string,
    status: LeadStatusValue,
  ): Promise<LeadRecord>;
  postExists(postId: string): Promise<boolean>;
}
