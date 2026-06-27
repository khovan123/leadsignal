import {Module} from '@nestjs/common';
import {CqrsModule} from '@nestjs/cqrs';
import {GetWorkspaceHandler} from './application/get-workspace.query';
import {WORKSPACE_REPOSITORY} from './domain/workspace.repository';
import {PrismaWorkspaceRepository} from './infrastructure/prisma-workspace.repository';
import {WorkspacesCqrsController} from './presentation/workspaces-cqrs.controller';
@Module({imports:[CqrsModule],controllers:[WorkspacesCqrsController],providers:[GetWorkspaceHandler,PrismaWorkspaceRepository,{provide:WORKSPACE_REPOSITORY,useExisting:PrismaWorkspaceRepository}]})
export class WorkspacesModule{}
