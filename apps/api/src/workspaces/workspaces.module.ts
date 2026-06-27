import { Module } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';
@Module({controllers:[WorkspacesController],providers:[{provide:WorkspacesService,useFactory:(prisma:PrismaService)=>new WorkspacesService(prisma),inject:[PrismaService]}]})
export class WorkspacesModule {}
