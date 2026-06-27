import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}
  async get(id: string) {
    const workspace = await this.prisma.workspace.findUnique({ where: { id }, include: { _count: { select: { members: true, leads: true, llmConnections: true } } } });
    if (!workspace) throw new NotFoundException('Workspace not found');
    return workspace;
  }
}
