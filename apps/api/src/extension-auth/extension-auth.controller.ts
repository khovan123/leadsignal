import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Ip,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ExtensionAuthService } from './extension-auth.service';
import { RedditSessionSyncService } from './reddit-session-sync.service';
import type {
  CreatePairingCodeInput,
  ExtensionBatchInput,
  PairExtensionInput,
  SyncRedditSessionInput,
  VerifyExtensionInput,
} from './extension-device.types';

@Controller()
export class ExtensionAuthController {
  constructor(
    @Inject(ExtensionAuthService)
    private readonly extensionAuth: ExtensionAuthService,
    @Inject(RedditSessionSyncService)
    private readonly redditSessionSync: RedditSessionSyncService,
  ) {}

  @Post('auth/extension/pair')
  pair(@Body() body: PairExtensionInput) {
    return this.extensionAuth.pair(body);
  }

  @Post('auth/extension/challenge')
  challenge(@Body('deviceId') deviceId: string) {
    return this.extensionAuth.createChallenge(deviceId);
  }

  @Post('auth/extension/verify')
  verify(@Body() body: VerifyExtensionInput) {
    return this.extensionAuth.verifyChallenge(body);
  }

  @Post('auth/extension/exchange')
  exchange(
    @Body('ticket') ticket: string | undefined,
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ) {
    return this.extensionAuth.exchangeTicket(ticket, { userAgent, ip });
  }

  @Post('auth/extension/reddit-session')
  syncRedditSession(@Body() body: SyncRedditSessionInput) {
    return this.redditSessionSync.sync(body);
  }

  @Post('extension/ingest')
  ingest(@Body() body: ExtensionBatchInput) {
    return this.extensionAuth.ingest(body);
  }

  @Post('workspaces/:workspaceId/extension-devices/pairing-codes')
  createPairingCode(
    @Param('workspaceId') workspaceId: string,
    @Req() request: any,
    @Body() body: CreatePairingCodeInput,
  ) {
    return this.extensionAuth.createPairingCode(
      workspaceId,
      request.user.sub,
      body,
    );
  }

  @Get('workspaces/:workspaceId/extension-devices')
  listDevices(@Param('workspaceId') workspaceId: string) {
    return this.extensionAuth.listDevices(workspaceId);
  }

  @Post('workspaces/:workspaceId/extension-devices/:deviceId/revoke')
  revokeDevice(
    @Param('workspaceId') workspaceId: string,
    @Param('deviceId') deviceId: string,
    @Req() request: any,
  ) {
    return this.extensionAuth.revokeDevice(
      workspaceId,
      request.user.sub,
      deviceId,
    );
  }
}
