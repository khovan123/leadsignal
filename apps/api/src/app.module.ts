import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { CryptoModule } from './crypto/crypto.module';
import { HealthModule } from './health/health.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { LlmModule } from './llm/llm.module';
import { LeadsModule } from './leads/leads.module';
import { QueueModule } from './queue/queue.module';
import { PostsModule } from './posts/posts.module';

@Module({
  imports: [DatabaseModule, CryptoModule, HealthModule, WorkspacesModule, LlmModule, LeadsModule, QueueModule, PostsModule],
})
export class AppModule {}
