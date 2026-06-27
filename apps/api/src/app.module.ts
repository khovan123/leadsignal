import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { CryptoModule } from './crypto/crypto.module';
import { HealthModule } from './health/health.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { LlmModule } from './llm/llm.module';
import { LeadsModule } from './leads/leads.module';
import { QueueModule } from './queue/queue.module';
import { PostsModule } from './posts/posts.module';
import { ProductionModule } from './production/production.module';
import { IdentityModule } from './identity/identity.module';

@Module({
  imports: [DatabaseModule, CryptoModule, HealthModule, WorkspacesModule, LlmModule, LeadsModule, QueueModule, PostsModule, ProductionModule, IdentityModule],
})
export class AppModule {}
