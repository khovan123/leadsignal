import { Controller, Get, Inject, Param, Query, Redirect, Req } from '@nestjs/common';
import { ProductionService } from './production.service';
@Controller('connections')
export class OAuthController {
  constructor(@Inject(ProductionService) private readonly service:ProductionService){}
  @Get(':provider/authorize') authorize(@Param('provider') provider:string,@Query('workspaceId') workspaceId:string,@Req() request:any){return this.service.oauthStart(provider,workspaceId,request.user.sub);}
  @Get(':provider/complete') @Redirect() async complete(@Param('provider') provider:string,@Query('code') code?:string,@Query('state') state?:string){const result=await this.service.oauthCallback(provider,code,state);const appUrl=process.env.PUBLIC_APP_URL??'http://localhost:3000';return {url:`${appUrl}/vi/llm?connected=${encodeURIComponent(result.provider)}`,statusCode:302};}
}
