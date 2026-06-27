import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { GetWorkspaceHandler } from './application/get-workspace.query';
import { WORKSPACE_REPOSITORY } from './domain/workspace.repository';
import { PrismaWorkspaceRepository } from './infrastructure/prisma-workspace.repository';
import { WorkspacesController } from './presentation/workspaces.controller';

@Module({
  imports: [CqrsModule],
  controllers: [WorkspacesController],
  providers: [
    GetWorkspaceHandler,
    PrismaWorkspaceRepository,
    {
      provide: WORKSPACE_REPOSITORY,
      useExisting: PrismaWorkspaceRepository,
    },
  ],
})
export class WorkspacesModule {}
