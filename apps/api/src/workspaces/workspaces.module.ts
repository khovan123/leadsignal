import {Module} from '@nestjs/common';
import {CqrsModule} from '@nestjs/cqrs';
import {PrismaService} from '../database/prisma.service';
import {GetWorkspaceHandler} from './application/get-workspace.query';
import {WORKSPACE_REPOSITORY} from './domain/workspace.repository';
import {PrismaWorkspaceRepository} from './infrastructure/prisma-workspace.repository';
import {WorkspacesCqrsController} from './presentation/workspaces-cqrs.controller';
@Module({imports:[CqrsModule],controllers:[WorkspacesCqrsController],providers:[GetWorkspaceHandler,{provide:PrismaWorkspaceRepository,useFactory:(prisma:PrismaService)=>new PrismaWorkspaceRepository(prisma),inject:[PrismaService]},{provide:WORKSPACE_REPOSITORY,useExisting:PrismaWorkspaceRepository}]})
export class WorkspacesModule{}
