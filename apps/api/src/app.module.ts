import { Module } from '@nestjs/common';
import { CryptoModule } from './crypto/crypto.module';
import { DatabaseModule } from './database/database.module';
import { ExtensionAuthModule } from './extension-auth/extension-auth.module';
import { HealthModule } from './health/health.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { LlmModule } from './llm/llm.module';
import { LeadsModule } from './leads/leads.module';
import { QueueModule } from './queue/queue.module';
import { PostsModule } from './posts/posts.module';
import { ProductionModule } from './production/production.module';
import { IdentityModule } from './identity/identity.module';
import { InvitationsModule } from './invitations/invitations.module';
import { ProviderConnectionsModule } from './provider-connections/provider-connections.module';
import { RedditPublicModule } from './reddit-public/reddit-public.module';
import { RedditSourcesModule } from './reddit-sources/reddit-sources.module';

@Module({
  imports: [
    DatabaseModule,
    CryptoModule,
    QueueModule,
    ProductionModule,
    ExtensionAuthModule,
    RedditPublicModule,
    RedditSourcesModule,
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
