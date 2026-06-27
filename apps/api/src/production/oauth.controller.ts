import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { ProductionService } from './production.service';

@Controller('connections')
export class OAuthController {
  constructor(private readonly service: ProductionService) {}

  @Get(':provider/authorize')
  authorize(@Param('provider') provider: string, @Query('workspaceId') workspaceId: string, @Req() request: any) {
    return this.service.oauthStart(provider, workspaceId, request.user.sub);
  }

  @Get(':provider/complete')
  complete(@Param('provider') provider: string, @Query('code') code?: string, @Query('state') state?: string) {
    return this.service.oauthCallback(provider, code, state);
  }
}
