import { Body, Controller, Headers, Inject, Ip, Post, Req } from '@nestjs/common';
import { ProductionService } from './production.service';
@Controller('auth')
export class SessionController {
  constructor(@Inject(ProductionService) private readonly service:ProductionService){}
  @Post('register') register(@Body() body:{email?:string;displayName?:string;password?:string},@Headers('user-agent') userAgent?:string,@Ip() ip?:string){return this.service.register(body,{userAgent,ip});}
  @Post('login') login(@Body() body:{email?:string;password?:string},@Headers('user-agent') userAgent?:string,@Ip() ip?:string){return this.service.login(body,{userAgent,ip});}
  @Post('refresh') refresh(@Body() body:{refreshToken?:string},@Headers('user-agent') userAgent?:string,@Ip() ip?:string){return this.service.refresh(body.refreshToken,{userAgent,ip});}
  @Post('logout') logout(@Req() request:any){return this.service.logout(request.user.sub,request.user.sid);}
}
