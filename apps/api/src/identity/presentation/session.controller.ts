import { Body, Controller, Headers, Ip, Post, Req } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  LoginUserCommand,
  LogoutUserCommand,
  RegisterUserCommand,
  RotateRefreshTokenCommand,
} from '../application/identity.use-cases';
import type {
  LoginInput,
  RegisterInput,
} from '../application/identity.port';

@Controller('auth')
export class SessionController {
  constructor(private readonly commands: CommandBus) {}

  @Post('register')
  register(
    @Body() body: RegisterInput,
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ) {
    return this.commands.execute(
      new RegisterUserCommand(body, { userAgent, ip }),
    );
  }

  @Post('login')
  login(
    @Body() body: LoginInput,
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ) {
    return this.commands.execute(new LoginUserCommand(body, { userAgent, ip }));
  }

  @Post('refresh')
  refresh(
    @Body('refreshToken') refreshToken: string | undefined,
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ) {
    return this.commands.execute(
      new RotateRefreshTokenCommand(refreshToken, { userAgent, ip }),
    );
  }

  @Post('logout')
  logout(@Req() request: any) {
    return this.commands.execute(
      new LogoutUserCommand(request.user.sub, request.user.sid),
    );
  }
}
