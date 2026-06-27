import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { LEAD_COMMAND_HANDLERS, LEAD_QUERY_HANDLERS } from './application/leads.use-cases';
import { LEAD_REPOSITORY } from './domain/lead.repository';
import { PrismaLeadRepository } from './infrastructure/prisma-lead.repository';
import { LeadsCqrsController } from './presentation/leads-cqrs.controller';
@Module({
 imports:[CqrsModule],
 controllers:[LeadsCqrsController],
 providers:[...LEAD_COMMAND_HANDLERS,...LEAD_QUERY_HANDLERS,PrismaLeadRepository,{provide:LEAD_REPOSITORY,useExisting:PrismaLeadRepository}],
})
export class LeadsModule{}
