import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { WorkspaceRole } from '@prisma/client';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { QueueService } from '../queue/queue.service';
import {
  randomToken,
  signAccessToken,
  tokenHash,
} from '../production/security';
import {
  assertNoCredentialFields,
  ingestionSigningMessage,
  loginSigningMessage,
  validateExtensionPublicKey,
  verifyExtensionSignature,
} from './extension-crypto';
import type {
  CreatePairingCodeInput,
  ExtensionBatchInput,
  ExtensionBatchPost,
  ExtensionBatchSource,
  PairExtensionInput,
  VerifyExtensionInput,
} from './extension-device.types';

interface RequestMeta {
  userAgent?: string;
  ip?: string;
}

@Injectable()
export class ExtensionAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  async createPairingCode(
    workspaceId: string,
    userId: string,
    input: CreatePairingCodeInput,
  ) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { role: true },
    });
    if (
      !membership ||
      ![WorkspaceRole.OWNER, WorkspaceRole.ADMIN].includes(membership.role)
    ) {
      throw new ForbiddenException(
        'Only workspace owners and admins can pair devices',
      );
    }

    const role = this.resolveRole(input.role);
    if (
      role === WorkspaceRole.OWNER &&
      membership.role !== WorkspaceRole.OWNER
    ) {
      throw new ForbiddenException('Only an owner can invite another owner');
    }
    await this.assertWorkspaceCapacity(workspaceId);

    const code = `LS-${randomBytes(4)
      .toString('hex')
      .toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const expiresInMinutes = Math.min(
      Math.max(Number(input.expiresInMinutes ?? 30), 5),
      24 * 60,
    );
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60_000);

    await this.prisma.extensionPairingCode.create({
      data: {
        workspaceId,
        invitedByUserId: userId,
        tokenHash: tokenHash(code),
        role,
        displayName: this.cleanText(input.displayName, 100),
        expiresAt,
      },
    });

    return { code, role, expiresAt };
  }

  async pair(input: PairExtensionInput) {
    const pairingCode = input.pairingCode?.trim();
    if (!pairingCode) {
      throw new BadRequestException('pairingCode is required');
    }
    const publicKeyJwk = validateExtensionPublicKey(input.publicKeyJwk);
    const deviceLabel =
      this.cleanText(input.deviceLabel, 120) ?? 'LeadSignal Extension';
    const redditUsername = this.cleanText(input.redditUsername, 100);
    const displayName =
      this.cleanText(input.displayName, 100) ??
      redditUsername ??
      deviceLabel;

    if (this.isBootstrapCode(pairingCode)) {
      return this.bootstrapFirstDevice({
        publicKeyJwk,
        deviceLabel,
        redditUsername,
        displayName,
      });
    }

    const pairing = await this.prisma.extensionPairingCode.findUnique({
      where: { tokenHash: tokenHash(pairingCode) },
    });
    if (!pairing || pairing.usedAt || pairing.expiresAt <= new Date()) {
      throw new UnauthorizedException(
        'Pairing code is invalid, expired or already used',
      );
    }
    await this.assertWorkspaceCapacity(pairing.workspaceId);

    const result = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.extensionPairingCode.updateMany({
        where: {
          id: pairing.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new ConflictException('Pairing code was already consumed');
      }

      const userId = randomUUID();
      const user = await tx.user.create({
        data: {
          id: userId,
          email: `${userId}@extension.leadsignal.local`,
          displayName: pairing.displayName ?? displayName,
        },
      });
      await tx.workspaceMember.create({
        data: {
          workspaceId: pairing.workspaceId,
          userId: user.id,
          role: pairing.role,
        },
      });
      const device = await tx.extensionDevice.create({
        data: {
          workspaceId: pairing.workspaceId,
          userId: user.id,
          publicKeyJwk,
          label: deviceLabel,
          redditUsername,
          lastSeenAt: new Date(),
        },
      });
      return { device, user };
    });

    return {
      deviceId: result.device.id,
      workspaceId: result.device.workspaceId,
      user: {
        id: result.user.id,
        displayName: result.user.displayName,
      },
    };
  }

  async createChallenge(deviceId: string) {
    const device = await this.activeDevice(deviceId);
    const nonce = randomToken(32);
    const challenge = await this.prisma.extensionAuthChallenge.create({
      data: {
        deviceId: device.id,
        nonceHash: tokenHash(nonce),
        expiresAt: new Date(Date.now() + 2 * 60_000),
      },
    });
    return {
      challengeId: challenge.id,
      nonce,
      expiresAt: challenge.expiresAt,
      message: loginSigningMessage(challenge.id, nonce),
    };
  }

  async verifyChallenge(input: VerifyExtensionInput) {
    const challenge = await this.prisma.extensionAuthChallenge.findFirst({
      where: {
        id: input.challengeId,
        deviceId: input.deviceId,
      },
      include: { device: true },
    });
    if (
      !challenge ||
      challenge.usedAt ||
      challenge.expiresAt <= new Date() ||
      challenge.nonceHash !== tokenHash(input.nonce)
    ) {
      throw new UnauthorizedException(
        'Extension challenge is invalid or expired',
      );
    }
    if (
      challenge.device.status !== 'ACTIVE' ||
      challenge.device.revokedAt
    ) {
      throw new UnauthorizedException('Extension device is not active');
    }

    verifyExtensionSignature(
      challenge.device.publicKeyJwk,
      loginSigningMessage(challenge.id, input.nonce),
      input.proof,
    );

    const ticket = randomToken(32);
    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.extensionAuthChallenge.updateMany({
        where: {
          id: challenge.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1) {
        throw new ConflictException(
          'Extension challenge was already consumed',
        );
      }
      await tx.extensionLoginTicket.create({
        data: {
          deviceId: challenge.deviceId,
          tokenHash: tokenHash(ticket),
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
      await tx.extensionDevice.update({
        where: { id: challenge.deviceId },
        data: { lastSeenAt: new Date() },
      });
    });

    return { ticket, expiresIn: 60 };
  }

  async exchangeTicket(
    ticketValue: string | undefined,
    meta: RequestMeta,
  ) {
    if (!ticketValue) throw new UnauthorizedException('ticket is required');
    const ticket = await this.prisma.extensionLoginTicket.findUnique({
      where: { tokenHash: tokenHash(ticketValue) },
      include: {
        device: {
          include: { user: true, workspace: true },
        },
      },
    });
    if (
      !ticket ||
      ticket.usedAt ||
      ticket.expiresAt <= new Date() ||
      ticket.device.status !== 'ACTIVE' ||
      ticket.device.revokedAt
    ) {
      throw new UnauthorizedException(
        'Login ticket is invalid, expired or already used',
      );
    }

    const consumed = await this.prisma.extensionLoginTicket.updateMany({
      where: {
        id: ticket.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) {
      throw new ConflictException('Login ticket was already consumed');
    }

    return this.issueSession(
      ticket.device.user,
      ticket.device.workspaceId,
      meta,
    );
  }

  async ingest(input: ExtensionBatchInput) {
    assertNoCredentialFields(input);
    const timestamp = new Date(input.timestamp);
    if (
      Number.isNaN(timestamp.getTime()) ||
      Math.abs(Date.now() - timestamp.getTime()) > 5 * 60_000
    ) {
      throw new UnauthorizedException(
        'Batch timestamp is outside the allowed window',
      );
    }
    if (!input.nonce || input.nonce.length < 16 || input.nonce.length > 200) {
      throw new BadRequestException('A valid batch nonce is required');
    }
    if (!Array.isArray(input.batch?.posts) || input.batch.posts.length === 0) {
      throw new BadRequestException('At least one post is required');
    }
    if (input.batch.posts.length > 100) {
      throw new BadRequestException('A batch can contain at most 100 posts');
    }

    const device = await this.activeDevice(input.deviceId);
    verifyExtensionSignature(
      device.publicKeyJwk,
      ingestionSigningMessage(input.timestamp, input.nonce, input.batch),
      input.proof,
    );

    const nonceHash = tokenHash(input.nonce);
    const existingNonce = await this.prisma.extensionReplayNonce.findUnique({
      where: {
        deviceId_nonceHash: { deviceId: device.id, nonceHash },
      },
    });
    if (existingNonce) {
      throw new ConflictException('Batch nonce was already used');
    }
    await this.prisma.extensionReplayNonce.create({
      data: {
        deviceId: device.id,
        nonceHash,
        expiresAt: new Date(Date.now() + 10 * 60_000),
      },
    });

    const source = await this.resolveSource(
      device.workspaceId,
      device.userId,
      input.batch.source,
    );
    let discovered = 0;
    let refreshed = 0;
    for (const rawPost of input.batch.posts) {
      const postInput = this.validatePost(rawPost, source.subreddit);
      const post = await this.prisma.redditPost.upsert({
        where: { externalPostId: postInput.externalPostId },
        update: {
          subreddit: postInput.subreddit,
          authorUsername: postInput.authorUsername,
          title: postInput.title,
          ...(postInput.body ? { body: postInput.body } : {}),
          permalink: postInput.permalink,
          score: postInput.score,
          commentCount: postInput.commentCount,
        },
        create: postInput,
      });
      const key = {
        workspaceId: device.workspaceId,
        postId: post.id,
        sourceId: source.id,
      };
      const existing = await this.prisma.postDiscovery.findUnique({
        where: { workspaceId_postId_sourceId: key },
        select: { id: true },
      });
      await this.prisma.postDiscovery.upsert({
        where: { workspaceId_postId_sourceId: key },
        update: { discoveredAt: new Date() },
        create: key,
      });
      if (existing) {
        refreshed += 1;
      } else {
        discovered += 1;
        await this.queue.enqueueClassification(device.workspaceId, post.id);
      }
    }

    await this.prisma.$transaction([
      this.prisma.extensionDevice.update({
        where: { id: device.id },
        data: { lastSeenAt: new Date() },
      }),
      this.prisma.extensionReplayNonce.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      }),
    ]);

    return {
      accepted: input.batch.posts.length,
      discovered,
      refreshed,
      sourceId: source.id,
      workspaceId: device.workspaceId,
    };
  }

  async listDevices(workspaceId: string) {
    return this.prisma.extensionDevice.findMany({
      where: { workspaceId },
      select: {
        id: true,
        userId: true,
        label: true,
        redditUsername: true,
        status: true,
        lastSeenAt: true,
        createdAt: true,
        revokedAt: true,
        user: { select: { displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeDevice(
    workspaceId: string,
    actorUserId: string,
    deviceId: string,
  ) {
    const actor = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId: actorUserId },
      },
      select: { role: true },
    });
    if (
      !actor ||
      ![WorkspaceRole.OWNER, WorkspaceRole.ADMIN].includes(actor.role)
    ) {
      throw new ForbiddenException(
        'Only workspace owners and admins can revoke devices',
      );
    }
    const result = await this.prisma.extensionDevice.updateMany({
      where: { id: deviceId, workspaceId, revokedAt: null },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
    if (result.count !== 1) {
      throw new NotFoundException('Active device not found');
    }
    return { success: true };
  }

  private async bootstrapFirstDevice(input: {
    publicKeyJwk: ReturnType<typeof validateExtensionPublicKey>;
    deviceLabel: string;
    redditUsername?: string;
    displayName: string;
  }) {
    const existingDevices = await this.prisma.extensionDevice.count();
    if (existingDevices > 0) {
      throw new ForbiddenException(
        'Bootstrap pairing is only allowed for the first device',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const userId = randomUUID();
      const workspaceId = randomUUID();
      const slugBase =
        input.displayName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'private';
      const user = await tx.user.create({
        data: {
          id: userId,
          email: `${userId}@extension.leadsignal.local`,
          displayName: input.displayName,
        },
      });
      const workspace = await tx.workspace.create({
        data: {
          id: workspaceId,
          name: `${input.displayName}'s workspace`,
          slug: `${slugBase}-${workspaceId.slice(0, 8)}`,
        },
      });
      await tx.workspaceMember.create({
        data: {
          workspaceId,
          userId,
          role: WorkspaceRole.OWNER,
        },
      });
      const device = await tx.extensionDevice.create({
        data: {
          workspaceId,
          userId,
          publicKeyJwk: input.publicKeyJwk,
          label: input.deviceLabel,
          redditUsername: input.redditUsername,
          lastSeenAt: new Date(),
        },
      });
      return { user, workspace, device };
    });

    return {
      deviceId: result.device.id,
      workspaceId: result.workspace.id,
      user: {
        id: result.user.id,
        displayName: result.user.displayName,
      },
      bootstrap: true,
    };
  }

  private async activeDevice(deviceId: string) {
    if (!deviceId) throw new BadRequestException('deviceId is required');
    const device = await this.prisma.extensionDevice.findUnique({
      where: { id: deviceId },
    });
    if (!device || device.status !== 'ACTIVE' || device.revokedAt) {
      throw new UnauthorizedException('Extension device is not active');
    }
    return device;
  }

  private async assertWorkspaceCapacity(workspaceId: string) {
    const members = await this.prisma.workspaceMember.count({
      where: { workspaceId },
    });
    const limit = Math.max(1, Number(process.env.MAX_PRIVATE_USERS ?? 10));
    if (members >= limit) {
      throw new ConflictException(
        `Workspace has reached the ${limit}-member limit`,
      );
    }
  }

  private resolveRole(
    value: WorkspaceRole | string | undefined,
  ): WorkspaceRole {
    const normalized = String(value ?? WorkspaceRole.MEMBER).toUpperCase();
    if (
      !Object.values(WorkspaceRole).includes(normalized as WorkspaceRole)
    ) {
      throw new BadRequestException('Invalid workspace role');
    }
    return normalized as WorkspaceRole;
  }

  private isBootstrapCode(value: string): boolean {
    const expected = process.env.EXTENSION_BOOTSTRAP_CODE;
    if (!expected) return false;
    const left = Buffer.from(value);
    const right = Buffer.from(expected);
    return left.length === right.length && timingSafeEqual(left, right);
  }

  private async issueSession(
    user: { id: string; email: string; displayName: string },
    workspaceId: string,
    meta: RequestMeta,
  ) {
    const refreshToken = randomToken();
    const sessionId = randomUUID();
    const familyId = randomUUID();
    const expiresAt = new Date(
      Date.now() +
        Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30) * 86_400_000,
    );
    await this.prisma.$executeRaw`
      INSERT INTO "AuthSession"
        (id,"userId","familyId","tokenHash","userAgent","ipAddress","expiresAt")
      VALUES
        (${sessionId}::uuid,${user.id}::uuid,${familyId}::uuid,${tokenHash(refreshToken)},${meta.userAgent ?? null},${meta.ip ?? null},${expiresAt})
    `;
    return {
      accessToken: signAccessToken({
        userId: user.id,
        email: user.email,
        sessionId,
      }),
      refreshToken,
      expiresIn: Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 900),
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        workspaceId,
      },
    };
  }

  private async resolveSource(
    workspaceId: string,
    userId: string,
    input: ExtensionBatchSource,
  ) {
    const sourceId = this.cleanText(input.sourceId, 100);
    if (sourceId) {
      const source = await this.prisma.redditSource.findFirst({
        where: {
          id: sourceId,
          workspaceId,
          ownerUserId: userId,
          enabled: true,
        },
      });
      if (!source) {
        throw new NotFoundException('Configured Reddit source not found');
      }
      return source;
    }

    const type = (
      this.cleanText(input.type, 50) ?? 'CUSTOM_URL'
    ).toUpperCase();
    const subreddit = this.cleanText(input.subreddit, 100)?.replace(
      /^r\//i,
      '',
    );
    const searchQuery =
      this.cleanText(input.searchQuery, 1000) ??
      this.validateRedditUrl(input.url, true);
    const name =
      this.cleanText(input.name, 120) ??
      (subreddit ? `r/${subreddit}` : `${type} extension source`);

    const existing = await this.prisma.redditSource.findFirst({
      where: {
        workspaceId,
        ownerUserId: userId,
        type,
        subreddit: subreddit ?? null,
        searchQuery: searchQuery ?? null,
      },
    });
    if (existing) return existing;

    return this.prisma.redditSource.create({
      data: {
        workspaceId,
        ownerUserId: userId,
        type,
        name,
        subreddit,
        searchQuery,
        enabled: true,
      },
    });
  }

  private validatePost(
    input: ExtensionBatchPost,
    defaultSubreddit: string | null,
  ) {
    const permalink = this.validateRedditUrl(input.permalink, false);
    if (!permalink) {
      throw new BadRequestException('Post permalink is required');
    }
    const idFromUrl = permalink.match(
      /\/comments\/([a-z0-9]+)(?:\/|$)/i,
    )?.[1];
    const providedId = this.cleanText(input.externalPostId, 100);
    const externalPostId = providedId?.startsWith('t3_')
      ? providedId
      : providedId
        ? `t3_${providedId}`
        : idFromUrl
          ? `t3_${idFromUrl}`
          : undefined;
    if (!externalPostId || !/^t3_[a-z0-9_]+$/i.test(externalPostId)) {
      throw new BadRequestException('Unable to resolve Reddit post ID');
    }
    const title = this.cleanText(input.title, 500);
    if (!title) throw new BadRequestException('Post title is required');
    const body = this.cleanText(input.body, 100_000) ?? '';
    const subreddit =
      this.cleanText(input.subreddit, 100)?.replace(/^r\//i, '') ??
      defaultSubreddit ??
      'unknown';
    const postedAt = input.postedAt
      ? new Date(input.postedAt)
      : new Date();

    return {
      externalPostId,
      subreddit,
      authorUsername: this.cleanText(
        input.authorUsername,
        100,
      )?.replace(/^u\//i, ''),
      title,
      body,
      permalink,
      score: this.safeCount(input.score),
      commentCount: this.safeCount(input.commentCount),
      postedAt: Number.isNaN(postedAt.getTime()) ? new Date() : postedAt,
    };
  }

  private validateRedditUrl(
    value: string | undefined,
    optional: boolean,
  ): string | undefined {
    if (!value) {
      if (optional) return undefined;
      throw new BadRequestException('Reddit URL is required');
    }
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException('Invalid Reddit URL');
    }
    const host = url.hostname.toLowerCase();
    if (host !== 'reddit.com' && !host.endsWith('.reddit.com')) {
      throw new BadRequestException('Only reddit.com URLs are accepted');
    }
    url.protocol = 'https:';
    url.hash = '';
    return url.href;
  }

  private cleanText(
    value: unknown,
    maxLength: number,
  ): string | undefined {
    if (typeof value !== 'string') return undefined;
    const result = value.trim();
    if (!result) return undefined;
    if (result.length > maxLength) {
      throw new BadRequestException(
        `Text value exceeds ${maxLength} characters`,
      );
    }
    return result;
  }

  private safeCount(value: unknown): number {
    const number = Number(value ?? 0);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.min(Math.round(number), 2_147_483_647));
  }
}
