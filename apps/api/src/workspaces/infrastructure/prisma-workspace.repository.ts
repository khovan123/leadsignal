import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type {
  WorkspaceDetails,
  WorkspaceRepository,
} from '../domain/workspace.repository';

@Injectable()
export class PrismaWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly prisma: PrismaService) {}

  findDetails(id: string): Promise<WorkspaceDetails | null> {
    return this.prisma.workspace.findUnique({
      where: { id },
      include: {
        _count: {
          select: { members: true, leads: true, llmConnections: true },
        },
      },
    });
  }
}
