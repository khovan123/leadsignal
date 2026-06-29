import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  stableStringify,
  verifyExtensionSignature,
} from '../../extension-auth/extension-crypto';
import { tokenHash } from '../../production/security';
import {
  REDDIT_SOURCE_REPOSITORY,
  type IRedditSourceRepository,
  type RedditSourceConfiguration,
} from '../domain/reddit-source.repository';

export interface ExtensionSourceContext {
  type: string;
  subreddit?: string;
  searchQuery?: string;
  url: string;
}

export interface ExtensionSourceConfigInput {
  deviceId: string;
  timestamp: string;
  nonce: string;
  proof: string;
  context: ExtensionSourceContext;
}

@Injectable()
export class ExtensionSourceConfigService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(REDDIT_SOURCE_REPOSITORY)
    private readonly repository: IRedditSourceRepository,
  ) {}

  async resolve(input: ExtensionSourceConfigInput) {
    const timestamp = new Date(input.timestamp);
    if (
      Number.isNaN(timestamp.getTime()) ||
      Math.abs(Date.now() - timestamp.getTime()) > 300000
    ) {
      throw new UnauthorizedException(
        'Source config timestamp is outside the allowed window',
      );
    }
    if (!input.nonce || input.nonce.length < 16 || input.nonce.length > 200) {
      throw new BadRequestException('A valid source config nonce is required');
    }

    const device = await this.prisma.extensionDevice.findUnique({
      where: { id: input.deviceId },
    });
    if (!device || device.status !== 'ACTIVE' || device.revokedAt) {
      throw new UnauthorizedException('Extension device is not active');
    }

    verifyExtensionSignature(
      device.publicKeyJwk,
      sourceConfigSigningMessage(input.timestamp, input.nonce, input.context),
      input.proof,
    );
    try {
      await this.prisma.extensionReplayNonce.create({
        data: {
          deviceId: device.id,
          nonceHash: tokenHash(input.nonce),
          expiresAt: new Date(Date.now() + 600000),
        },
      });
    } catch {
      throw new ConflictException('Source config nonce was already used');
    }

    const sources = await this.repository.list(
      device.workspaceId,
      device.userId,
    );
    const source = this.matchSource(sources, input.context);
    return {
      workspaceId: device.workspaceId,
      sourceId: source?.id,
      source: source
        ? this.toSettings(source)
        : this.defaults(input.context),
    };
  }

  private matchSource(
    sources: RedditSourceConfiguration[],
    context: ExtensionSourceContext,
  ) {
    const type = context.type.trim().toUpperCase();
    const subreddit = context.subreddit
      ?.trim()
      .replace(/^r\//i, '')
      .toLowerCase();
    const query = context.searchQuery?.trim().toLowerCase();

    return sources.find((source) => {
      if (!source.enabled || source.type !== type) return false;
      if (type === 'SUBREDDIT') {
        return source.subreddit?.toLowerCase() === subreddit;
      }
      if (type === 'SEARCH') {
        return source.searchQuery?.toLowerCase() === query;
      }
      if (type === 'CUSTOM_URL') return source.searchQuery === context.url;
      return true;
    });
  }

  private toSettings(source: RedditSourceConfiguration) {
    return {
      id: source.id,
      type: source.type,
      name: source.name,
      subreddit: source.subreddit,
      searchQuery: source.searchQuery,
      targetPostCount: source.targetPostCount,
      maxScrolls: source.maxScrolls,
      maxStallRounds: source.maxStallRounds,
      includePromoted: source.includePromoted,
      includePinned: source.includePinned,
      includeNsfw: source.includeNsfw,
      detailEnabled: source.detailEnabled,
      commentsTopN: source.commentsTopN,
    };
  }

  private defaults(context: ExtensionSourceContext) {
    return {
      id: undefined,
      type: context.type.trim().toUpperCase(),
      name: context.subreddit
        ? `r/${context.subreddit}`
        : `${context.type} browser feed`,
      subreddit: context.subreddit,
      searchQuery: context.searchQuery,
      targetPostCount: 50,
      maxScrolls: 20,
      maxStallRounds: 4,
      includePromoted: false,
      includePinned: false,
      includeNsfw: false,
      detailEnabled: true,
      commentsTopN: 0,
    };
  }
}

export function sourceConfigSigningMessage(
  timestamp: string,
  nonce: string,
  context: ExtensionSourceContext,
) {
  return `LeadSignal extension source config v1\n${timestamp}\n${nonce}\n${stableStringify(context)}`;
}
