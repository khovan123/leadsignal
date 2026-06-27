import { Injectable } from '@nestjs/common';
import type { LeadStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type {
  LeadRecord,
  LeadRepository,
} from '../domain/lead.repository';
import type { LeadStatusValue } from '../domain/lead-status.value-object';

@Injectable()
export class PrismaLeadRepository implements LeadRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByWorkspace(workspaceId: string): Promise<LeadRecord[]> {
    return this.prisma.lead.findMany({
      where: { workspaceId },
      orderBy: [{ priorityScore: 'desc' }, { createdAt: 'desc' }],
      include: { post: true, classification: true },
    }) as Promise<LeadRecord[]>;
  }

  async exists(workspaceId: string, leadId: string): Promise<boolean> {
    const count = await this.prisma.lead.count({
      where: { id: leadId, workspaceId },
    });
    return count > 0;
  }

  updateStatus(
    workspaceId: string,
    leadId: string,
    status: LeadStatusValue,
  ): Promise<LeadRecord> {
    return this.prisma.lead.update({
      where: { id: leadId, workspaceId },
      data: { status: status as LeadStatus },
    }) as Promise<LeadRecord>;
  }

  async postExists(postId: string): Promise<boolean> {
    const count = await this.prisma.redditPost.count({ where: { id: postId } });
    return count > 0;
  }
}
