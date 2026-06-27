import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  IDENTITY_PORT,
  type IdentityPort,
  type LoginInput,
  type RegisterInput,
  type RequestMetadata,
} from './identity.port';

export class RegisterUserCommand {
  constructor(
    readonly input: RegisterInput,
    readonly metadata: RequestMetadata,
  ) {}
}

export class LoginUserCommand {
  constructor(
    readonly input: LoginInput,
    readonly metadata: RequestMetadata,
  ) {}
}

export class RotateRefreshTokenCommand {
  constructor(
    readonly refreshToken: string | undefined,
    readonly metadata: RequestMetadata,
  ) {}
}

export class LogoutUserCommand {
  constructor(
    readonly userId: string,
    readonly sessionId: string,
  ) {}
}

@CommandHandler(RegisterUserCommand)
export class RegisterUserHandler
  implements ICommandHandler<RegisterUserCommand>
{
  constructor(
    @Inject(IDENTITY_PORT)
    private readonly identity: IdentityPort,
  ) {}

  execute(command: RegisterUserCommand) {
    return this.identity.register(command.input, command.metadata);
  }
}

@CommandHandler(LoginUserCommand)
export class LoginUserHandler implements ICommandHandler<LoginUserCommand> {
  constructor(
    @Inject(IDENTITY_PORT)
    private readonly identity: IdentityPort,
  ) {}

  execute(command: LoginUserCommand) {
    return this.identity.login(command.input, command.metadata);
  }
}

@CommandHandler(RotateRefreshTokenCommand)
export class RotateRefreshTokenHandler
  implements ICommandHandler<RotateRefreshTokenCommand>
{
  constructor(
    @Inject(IDENTITY_PORT)
    private readonly identity: IdentityPort,
  ) {}

  execute(command: RotateRefreshTokenCommand) {
    return this.identity.refresh(command.refreshToken, command.metadata);
  }
}

@CommandHandler(LogoutUserCommand)
export class LogoutUserHandler
  implements ICommandHandler<LogoutUserCommand>
{
  constructor(
    @Inject(IDENTITY_PORT)
    private readonly identity: IdentityPort,
  ) {}

  execute(command: LogoutUserCommand) {
    return this.identity.logout(command.userId, command.sessionId);
  }
}

export const IDENTITY_COMMAND_HANDLERS = [
  RegisterUserHandler,
  LoginUserHandler,
  RotateRefreshTokenHandler,
  LogoutUserHandler,
];
