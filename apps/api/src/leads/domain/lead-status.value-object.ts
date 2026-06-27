export const LEAD_STATUSES = [
  'NEW',
  'REVIEWING',
  'QUALIFIED',
  'ASSIGNED',
  'CONTACTED',
  'CONVERTED',
  'REJECTED',
  'ARCHIVED',
] as const;

export type LeadStatusValue = (typeof LEAD_STATUSES)[number];

export class LeadStatus {
  private constructor(readonly value: LeadStatusValue) {}

  static create(value: unknown): LeadStatus {
    if (
      typeof value !== 'string' ||
      !LEAD_STATUSES.includes(value as LeadStatusValue)
    ) {
      throw new Error(`Invalid lead status: ${String(value)}`);
    }
    return new LeadStatus(value as LeadStatusValue);
  }
}
