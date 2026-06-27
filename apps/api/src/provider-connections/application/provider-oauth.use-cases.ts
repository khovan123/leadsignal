import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  PROVIDER_OAUTH_PORT,
  type ProviderOAuthPort,
} from './provider-oauth.port';

export class StartProviderOAuthCommand {
  constructor(
    readonly provider: string,
    readonly workspaceId: string,
    readonly userId: string,
  ) {}
}

export class CompleteProviderOAuthCommand {
  constructor(
    readonly provider: string,
    readonly code: string | undefined,
    readonly state: string | undefined,
  ) {}
}

@CommandHandler(StartProviderOAuthCommand)
export class StartProviderOAuthHandler
  implements ICommandHandler<StartProviderOAuthCommand>
{
  constructor(
    @Inject(PROVIDER_OAUTH_PORT)
    private readonly oauth: ProviderOAuthPort,
  ) {}

  execute(command: StartProviderOAuthCommand) {
    return this.oauth.start(
      command.provider,
      command.workspaceId,
      command.userId,
    );
  }
}

@CommandHandler(CompleteProviderOAuthCommand)
export class CompleteProviderOAuthHandler
  implements ICommandHandler<CompleteProviderOAuthCommand>
{
  constructor(
    @Inject(PROVIDER_OAUTH_PORT)
    private readonly oauth: ProviderOAuthPort,
  ) {}

  execute(command: CompleteProviderOAuthCommand) {
    return this.oauth.complete(
      command.provider,
      command.code,
      command.state,
    );
  }
}

export const PROVIDER_OAUTH_COMMAND_HANDLERS = [
  StartProviderOAuthHandler,
  CompleteProviderOAuthHandler,
];
