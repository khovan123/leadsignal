import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

@Global()
@Module({ controllers: [AuthController], providers: [SessionService, TokenService], exports: [SessionService, TokenService] })
export class AuthModule {}
