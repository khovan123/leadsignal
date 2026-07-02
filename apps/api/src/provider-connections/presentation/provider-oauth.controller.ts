import { Controller, Get, Param, Query, Redirect, Req } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import {
  CompleteProviderOAuthCommand,
  StartProviderOAuthCommand,
} from "../application/provider-oauth.use-cases";

@Controller("connections")
export class ProviderOAuthController {
  constructor(private readonly commands: CommandBus) {}

  @Get(":provider/authorize")
  authorize(
    @Param("provider") provider: string,
    @Query("workspaceId") workspaceId: string,
    @Req() request: any,
  ) {
    return this.commands.execute(
      new StartProviderOAuthCommand(provider, workspaceId, request.user.sub),
    );
  }

  @Get(":provider/complete")
  @Redirect()
  async complete(
    @Param("provider") provider: string,
    @Query("code") code?: string,
    @Query("state") state?: string,
  ) {
    const result = await this.commands.execute<
      CompleteProviderOAuthCommand,
      { provider: string }
    >(new CompleteProviderOAuthCommand(provider, code, state));
    const appUrl = process.env.PUBLIC_APP_URL ?? "http://localhost:3000";
    return {
      url: `${appUrl}/vi/llm?connected=${encodeURIComponent(result.provider)}`,
      statusCode: 302,
    };
  }
}
