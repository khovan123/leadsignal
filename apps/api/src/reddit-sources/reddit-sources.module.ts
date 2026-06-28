import {Module} from '@nestjs/common';
import {CqrsModule} from '@nestjs/cqrs';
import {PrismaService} from '../database/prisma.service';
import {REDDIT_SOURCE_HANDLERS} from './application/reddit-source.use-cases';
import {REDDIT_SOURCE_REPOSITORY} from './domain/reddit-source.repository';
import {PrismaRedditSourceRepository} from './infrastructure/prisma-reddit-source.repository';
import {RedditSourcesController} from './presentation/reddit-sources.controller';

@Module({
  imports:[CqrsModule],
  controllers:[RedditSourcesController],
  providers:[
    ...REDDIT_SOURCE_HANDLERS,
    {provide:PrismaRedditSourceRepository,useFactory:(prisma:PrismaService)=>new PrismaRedditSourceRepository(prisma),inject:[PrismaService]},
    {provide:REDDIT_SOURCE_REPOSITORY,useExisting:PrismaRedditSourceRepository},
  ],
})
export class RedditSourcesModule{}
