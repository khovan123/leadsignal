import { Module } from '@nestjs/common';
import { CryptoModule } from './crypto/crypto.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { IdentityModule } from './identity/identity.module';
import { InvitationsModule } from './invitations/invitations.module';
import { LeadsModule } from './leads/leads.module';
import { LlmModule } from './llm/llm.module';
import { PostsModule } from './posts/posts.module';
import { ProductionModule } from './production/production.module';
import { ProviderConnectionsModule } from './provider-connections/provider-connections.module';
import { QueueModule } from './queue/queue.module';
import { RedditPublicModule } from './reddit-public/reddit-public.module';
import { WorkspacesModule } from './workspaces/workspaces.module';

@Module({
  imports: [
    DatabaseModule,
    CryptoModule,
    QueueModule,
    ProductionModule,
    RedditPublicModule,
    IdentityModule,
    InvitationsModule,
    ProviderConnectionsModule,
    HealthModule,
    WorkspacesModule,
    LlmModule,
    LeadsModule,
    PostsModule,
  ],
})
export class AppModule {}
