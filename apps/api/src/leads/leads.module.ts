import { Inject, Module } from '@nestjs/common';
import { CommandHandler, CqrsModule } from '@nestjs/cqrs';
import { QueueService } from '../queue/queue.service';
import {
  ClassifyPostCommand,
  ClassifyPostHandler,
  ListLeadsHandler,
  UpdateLeadStatusHandler,
} from './application/leads.use-cases';
import { LEAD_REPOSITORY, type LeadRepository } from './domain/lead.repository';
import { PrismaLeadRepository } from './infrastructure/prisma-lead.repository';
import { LeadsCqrsController } from './presentation/leads-cqrs.controller';

@CommandHandler(ClassifyPostCommand)
class WiredClassifyPostHandler extends ClassifyPostHandler {
  constructor(
    @Inject(LEAD_REPOSITORY) leads: LeadRepository,
    @Inject(QueueService) queue: QueueService,
  ) {
    super(leads, queue);
  }
}

@Module({
  imports: [CqrsModule],
  controllers: [LeadsCqrsController],
  providers: [
    ListLeadsHandler,
    UpdateLeadStatusHandler,
    WiredClassifyPostHandler,
    PrismaLeadRepository,
    { provide: LEAD_REPOSITORY, useExisting: PrismaLeadRepository },
  ],
})
export class LeadsModule {}
