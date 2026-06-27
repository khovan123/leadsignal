import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CryptoService } from '../crypto/crypto.service';
import { PrismaService } from '../database/prisma.service';
import { QueueService } from '../queue/queue.service';
import { InvitationsController } from './invitations.controller';
import { OAuthController } from './oauth.controller';
import { ProductionAuthGuard } from './production.guard';
import { ProductionService } from './production.service';
import { SessionController } from './session.controller';

@Global()
@Module({
  controllers:[SessionController,InvitationsController,OAuthController],
  providers:[
    {provide:ProductionService,useFactory:(prisma:PrismaService,crypto:CryptoService,queue:QueueService)=>new ProductionService(prisma,crypto,queue),inject:[PrismaService,CryptoService,QueueService]},
    {provide:ProductionAuthGuard,useFactory:(prisma:PrismaService)=>new ProductionAuthGuard(prisma),inject:[PrismaService]},
    {provide:APP_GUARD,useExisting:ProductionAuthGuard},
  ],
  exports:[ProductionService],
})
export class ProductionModule {}
