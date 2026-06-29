import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import {
  REDDIT_SOURCE_SORTS,
  REDDIT_SOURCE_TIME_RANGES,
  REDDIT_SOURCE_TYPES,
  type IRedditSourceRepository,
  type RedditCollectionMode,
  type RedditSourceConfiguration,
  type RedditSourceSort,
  type RedditSourceTimeRange,
  type RedditSourceType,
  type SaveRedditSourceInput,
} from '../domain/reddit-source.repository';

interface RedditSourceRow {
  id: string;
  workspaceId: string;
  ownerUserId: string;
  name: string;
  type: string;
  subreddit: string | null;
  searchQuery: string | null;
  enabled: boolean;
  sort: string;
  timeRange: string;
  targetPostCount: number;
  maxScrolls: number;
  maxStallRounds: number;
  includePromoted: boolean;
  includePinned: boolean;
  includeNsfw: boolean;
  detailEnabled: boolean;
  commentsTopN: number;
  collectionMode: string;
  lastRunAt: Date | null;
  lastStatus: string;
  lastCollected: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_NAMES: Record<RedditSourceType, string> = {
  HOME: 'Reddit Home',
  POPULAR: 'Reddit Popular',
  NEWS: 'Reddit News',
  BEST: 'Reddit Best',
  FOLLOWING: 'Reddit Following',
  LATEST: 'Reddit Latest',
  SUBREDDIT: 'Subreddit',
  SEARCH: 'Reddit Search',
  CUSTOM_URL: 'Reddit URL',
};

export class PrismaRedditSourceRepository implements IRedditSourceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    workspaceId: string,
    userId: string,
  ): Promise<RedditSourceConfiguration[]> {
    const rows = await this.prisma.$queryRaw<RedditSourceRow[]>`
      SELECT
        s.id,
        s."workspaceId",
        s."ownerUserId",
        s.name,
        s.type,
        s.subreddit,
        s."searchQuery",
        s.enabled,
        COALESCE(c.sort, 'NEW') AS sort,
        COALESCE(c."timeRange", 'ALL') AS "timeRange",
        COALESCE(c."targetPostCount", 50) AS "targetPostCount",
        COALESCE(c."maxScrolls", 20) AS "maxScrolls",
        COALESCE(c."maxStallRounds", 4) AS "maxStallRounds",
        COALESCE(c."includePromoted", false) AS "includePromoted",
        COALESCE(c."includePinned", false) AS "includePinned",
        COALESCE(c."includeNsfw", false) AS "includeNsfw",
        COALESCE(c."detailEnabled", true) AS "detailEnabled",
        COALESCE(c."commentsTopN", 0) AS "commentsTopN",
        COALESCE(
          c."collectionMode",
          CASE WHEN UPPER(s.type)='FOLLOWING' THEN 'EXTENSION' ELSE 'PUBLIC' END
        ) AS "collectionMode",
        c."lastRunAt",
        COALESCE(c."lastStatus", 'IDLE') AS "lastStatus",
        COALESCE(c."lastCollected", 0) AS "lastCollected",
        c."lastError",
        s."createdAt",
        s."updatedAt"
      FROM "RedditSource" s
      LEFT JOIN "RedditSourceConfig" c ON c."sourceId"=s.id
      WHERE s."workspaceId"=${workspaceId}::uuid
        AND s."ownerUserId"=${userId}::uuid
      ORDER BY s."createdAt" ASC
    `;
    return rows.map((row) => this.mapRow(row));
  }

  async get(
    workspaceId: string,
    userId: string,
    sourceId: string,
  ): Promise<RedditSourceConfiguration | null> {
    const rows = await this.prisma.$queryRaw<RedditSourceRow[]>`
      SELECT
        s.id,
        s."workspaceId",
        s."ownerUserId",
        s.name,
        s.type,
        s.subreddit,
        s."searchQuery",
        s.enabled,
        COALESCE(c.sort, 'NEW') AS sort,
        COALESCE(c."timeRange", 'ALL') AS "timeRange",
        COALESCE(c."targetPostCount", 50) AS "targetPostCount",
        COALESCE(c."maxScrolls", 20) AS "maxScrolls",
        COALESCE(c."maxStallRounds", 4) AS "maxStallRounds",
        COALESCE(c."includePromoted", false) AS "includePromoted",
        COALESCE(c."includePinned", false) AS "includePinned",
        COALESCE(c."includeNsfw", false) AS "includeNsfw",
        COALESCE(c."detailEnabled", true) AS "detailEnabled",
        COALESCE(c."commentsTopN", 0) AS "commentsTopN",
        COALESCE(
          c."collectionMode",
          CASE WHEN UPPER(s.type)='FOLLOWING' THEN 'EXTENSION' ELSE 'PUBLIC' END
        ) AS "collectionMode",
        c."lastRunAt",
        COALESCE(c."lastStatus", 'IDLE') AS "lastStatus",
        COALESCE(c."lastCollected", 0) AS "lastCollected",
        c."lastError",
        s."createdAt",
        s."updatedAt"
      FROM "RedditSource" s
      LEFT JOIN "RedditSourceConfig" c ON c."sourceId"=s.id
      WHERE s.id=${sourceId}::uuid
        AND s."workspaceId"=${workspaceId}::uuid
        AND s."ownerUserId"=${userId}::uuid
      LIMIT 1
    `;
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async create(
    workspaceId: string,
    userId: string,
    input: SaveRedditSourceInput,
  ): Promise<RedditSourceConfiguration> {
    const value = this.normalize(input);
    const sourceId = randomUUID();

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "RedditSource" (
          id,"workspaceId","ownerUserId",name,type,subreddit,"searchQuery",enabled,"createdAt","updatedAt"
        ) VALUES (
          ${sourceId}::uuid,${workspaceId}::uuid,${userId}::uuid,${value.name},${value.type},
          ${value.subreddit},${value.searchQuery},${value.enabled},NOW(),NOW()
        )
      `;
      await tx.$executeRaw`
        INSERT INTO "RedditSourceConfig" (
          "sourceId",sort,"timeRange","targetPostCount","maxScrolls","maxStallRounds",
          "includePromoted","includePinned","includeNsfw","detailEnabled","commentsTopN",
          "collectionMode","updatedAt"
        ) VALUES (
          ${sourceId}::uuid,${value.sort},${value.timeRange},${value.targetPostCount},
          ${value.maxScrolls},${value.maxStallRounds},${value.includePromoted},${value.includePinned},
          ${value.includeNsfw},${value.detailEnabled},${value.commentsTopN},${value.collectionMode},NOW()
        )
      `;
    });

    return (await this.get(workspaceId, userId, sourceId))!;
  }

  async update(
    workspaceId: string,
    userId: string,
    sourceId: string,
    input: SaveRedditSourceInput,
  ): Promise<RedditSourceConfiguration> {
    const current = await this.get(workspaceId, userId, sourceId);
    if (!current) throw new NotFoundException('Reddit source not found');
    const value = this.normalize(input, current);

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.$executeRaw`
        UPDATE "RedditSource"
        SET
          name=${value.name},
          type=${value.type},
          subreddit=${value.subreddit},
          "searchQuery"=${value.searchQuery},
          enabled=${value.enabled},
          "updatedAt"=NOW()
        WHERE id=${sourceId}::uuid
          AND "workspaceId"=${workspaceId}::uuid
          AND "ownerUserId"=${userId}::uuid
      `;
      if (updated !== 1) throw new NotFoundException('Reddit source not found');

      await tx.$executeRaw`
        INSERT INTO "RedditSourceConfig" (
          "sourceId",sort,"timeRange","targetPostCount","maxScrolls","maxStallRounds",
          "includePromoted","includePinned","includeNsfw","detailEnabled","commentsTopN",
          "collectionMode","updatedAt"
        ) VALUES (
          ${sourceId}::uuid,${value.sort},${value.timeRange},${value.targetPostCount},
          ${value.maxScrolls},${value.maxStallRounds},${value.includePromoted},${value.includePinned},
          ${value.includeNsfw},${value.detailEnabled},${value.commentsTopN},${value.collectionMode},NOW()
        )
        ON CONFLICT ("sourceId") DO UPDATE SET
          sort=EXCLUDED.sort,
          "timeRange"=EXCLUDED."timeRange",
          "targetPostCount"=EXCLUDED."targetPostCount",
          "maxScrolls"=EXCLUDED."maxScrolls",
          "maxStallRounds"=EXCLUDED."maxStallRounds",
          "includePromoted"=EXCLUDED."includePromoted",
          "includePinned"=EXCLUDED."includePinned",
          "includeNsfw"=EXCLUDED."includeNsfw",
          "detailEnabled"=EXCLUDED."detailEnabled",
          "commentsTopN"=EXCLUDED."commentsTopN",
          "collectionMode"=EXCLUDED."collectionMode",
          "updatedAt"=NOW()
      `;
    });

    return (await this.get(workspaceId, userId, sourceId))!;
  }

  async remove(
    workspaceId: string,
    userId: string,
    sourceId: string,
  ): Promise<void> {
    const deleted = await this.prisma.$executeRaw`
      DELETE FROM "RedditSource"
      WHERE id=${sourceId}::uuid
        AND "workspaceId"=${workspaceId}::uuid
        AND "ownerUserId"=${userId}::uuid
    `;
    if (deleted !== 1) throw new NotFoundException('Reddit source not found');
  }

  async assertWorkspaceMember(workspaceId: string, userId: string): Promise<void> {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { id: true },
    });
    if (!membership) {
      throw new ForbiddenException('Workspace membership is required');
    }
  }

  private normalize(
    input: SaveRedditSourceInput,
    current?: RedditSourceConfiguration,
  ) {
    const type = String(input.type ?? current?.type ?? 'SUBREDDIT')
      .trim()
      .toUpperCase();
    if (!REDDIT_SOURCE_TYPES.includes(type as RedditSourceType)) {
      throw new BadRequestException('Unsupported Reddit source type');
    }
    const typed = type as RedditSourceType;
    const subreddit =
      this.clean(input.subreddit ?? current?.subreddit, 100)?.replace(/^r\//i, '') ??
      null;
    let searchQuery =
      this.clean(input.searchQuery ?? current?.searchQuery, 2000) ?? null;

    if (typed === 'SUBREDDIT' && !subreddit) {
      throw new BadRequestException('Subreddit name is required');
    }
    if (typed === 'SEARCH' && !searchQuery) {
      throw new BadRequestException('Search query is required');
    }
    if (typed === 'CUSTOM_URL') {
      if (!searchQuery) throw new BadRequestException('Reddit URL is required');
      searchQuery = this.validateRedditUrl(searchQuery);
    }

    const normalizedSubreddit = typed === 'SUBREDDIT' ? subreddit : null;
    const normalizedQuery = ['SEARCH', 'CUSTOM_URL'].includes(typed)
      ? searchQuery
      : null;
    const sortValue = String(
      input.sort ?? current?.sort ?? (typed === 'SUBREDDIT' ? 'NEW' : 'HOT'),
    ).toUpperCase();
    if (!REDDIT_SOURCE_SORTS.includes(sortValue as RedditSourceSort)) {
      throw new BadRequestException('Unsupported Reddit sort');
    }
    const timeValue = String(
      input.timeRange ?? current?.timeRange ?? 'ALL',
    ).toUpperCase();
    if (!REDDIT_SOURCE_TIME_RANGES.includes(timeValue as RedditSourceTimeRange)) {
      throw new BadRequestException('Unsupported Reddit time range');
    }
    const requestedMode = String(
      input.collectionMode ?? current?.collectionMode ?? 'PUBLIC',
    ).toUpperCase();
    if (!['PUBLIC', 'EXTENSION'].includes(requestedMode)) {
      throw new BadRequestException('collectionMode must be PUBLIC or EXTENSION');
    }
    const collectionMode: RedditCollectionMode =
      typed === 'FOLLOWING'
        ? 'EXTENSION'
        : (requestedMode as RedditCollectionMode);
    const name =
      this.clean(input.name ?? current?.name, 120) ??
      this.defaultName(typed, normalizedSubreddit, normalizedQuery);

    return {
      name,
      type: typed,
      subreddit: normalizedSubreddit,
      searchQuery: normalizedQuery,
      enabled: this.boolean(input.enabled, current?.enabled ?? true),
      sort: sortValue as RedditSourceSort,
      timeRange: timeValue as RedditSourceTimeRange,
      targetPostCount: this.integer(
        input.targetPostCount,
        current?.targetPostCount ?? 50,
        1,
        2000,
        'targetPostCount',
      ),
      maxScrolls: this.integer(
        input.maxScrolls,
        current?.maxScrolls ?? 20,
        1,
        100,
        'maxScrolls',
      ),
      maxStallRounds: this.integer(
        input.maxStallRounds,
        current?.maxStallRounds ?? 4,
        1,
        12,
        'maxStallRounds',
      ),
      includePromoted: this.boolean(
        input.includePromoted,
        current?.includePromoted ?? false,
      ),
      includePinned: this.boolean(
        input.includePinned,
        current?.includePinned ?? false,
      ),
      includeNsfw: this.boolean(
        input.includeNsfw,
        current?.includeNsfw ?? false,
      ),
      detailEnabled: this.boolean(
        input.detailEnabled,
        current?.detailEnabled ?? true,
      ),
      commentsTopN: this.integer(
        input.commentsTopN,
        current?.commentsTopN ?? 0,
        0,
        50,
        'commentsTopN',
      ),
      collectionMode,
    };
  }

  private defaultName(
    type: RedditSourceType,
    subreddit: string | null,
    query: string | null,
  ) {
    if (type === 'SUBREDDIT' && subreddit) return `r/${subreddit}`;
    if (type === 'SEARCH' && query) return `Search: ${query.slice(0, 80)}`;
    if (type === 'CUSTOM_URL') return 'Custom Reddit URL';
    return DEFAULT_NAMES[type];
  }

  private validateRedditUrl(value: string): string {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException('Invalid Reddit URL');
    }
    const host = url.hostname.toLowerCase();
    if (host !== 'reddit.com' && !host.endsWith('.reddit.com')) {
      throw new BadRequestException('Custom URL must use reddit.com');
    }
    url.protocol = 'https:';
    url.hash = '';
    return url.href;
  }

  private clean(value: unknown, max: number): string | undefined {
    if (typeof value !== 'string') return undefined;
    const result = value.trim();
    if (!result) return undefined;
    if (result.length > max) {
      throw new BadRequestException(`Text exceeds ${max} characters`);
    }
    return result;
  }

  private integer(
    value: unknown,
    fallback: number,
    min: number,
    max: number,
    field: string,
  ): number {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
      throw new BadRequestException(
        `${field} must be an integer between ${min} and ${max}`,
      );
    }
    return parsed;
  }

  private boolean(value: unknown, fallback: boolean): boolean {
    if (value === undefined || value === null) return fallback;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
    }
    return Boolean(value);
  }

  private mapRow(row: RedditSourceRow): RedditSourceConfiguration {
    return {
      ...row,
      type: row.type.toUpperCase() as RedditSourceType,
      sort: row.sort.toUpperCase() as RedditSourceSort,
      timeRange: row.timeRange.toUpperCase() as RedditSourceTimeRange,
      collectionMode: row.collectionMode.toUpperCase() as RedditCollectionMode,
    };
  }
}
