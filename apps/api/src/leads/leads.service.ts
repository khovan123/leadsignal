import { Injectable, NotFoundException } from '@nestjs/common';
import { leadStatusSchema } from '@leadsignal/contracts';
import { PrismaService } from '../database/prisma.service';
import { QueueService } from '../queue/queue.service';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService, private readonly queue: QueueService) {}
  list(workspaceId: string) {
    return this.prisma.lead.findMany({ where: { workspaceId }, orderBy: [{ priorityScore: 'desc' }, { createdAt: 'desc' }], include: { post: true, classification: true } });
  }
  async updateStatus(workspaceId: string, id: string, status: unknown) {
    const lead = await this.prisma.lead.findFirst({ where: { id, workspaceId } });
    if (!lead) throw new NotFoundException('Lead not found');
    return this.prisma.lead.update({ where: { id }, data: { status: leadStatusSchema.parse(status) } });
  }
  async classify(workspaceId: string, postId: string) {
    const post = await this.prisma.redditPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');
    return this.queue.enqueueClassification(workspaceId, postId);
  }
}
