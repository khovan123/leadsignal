import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { LlmProvider } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { CryptoService } from "../crypto/crypto.service";
import { PrismaService } from "../database/prisma.service";
import { QueueService } from "../queue/queue.service";
import {
  createPkce,
  hashPassword,
  randomToken,
  signAccessToken,
  tokenHash,
  verifyPassword,
} from "./security";

interface UserRow {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string | null;
  disabledAt: Date | null;
}

interface SessionRow {
  id: string;
  userId: string;
  familyId: string;
  replacedByHash: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  email: string;
  displayName: string;
}

interface OAuthStateRow {
  id: string;
  provider: string;
  workspaceId: string | null;
  userId: string | null;
  redirectUri: string;
  codeVerifier: string | null;
}

interface OAuthCredentialRow {
  id: string;
  connectionId: string;
  provider: LlmProvider;
  encryptedCredential: string;
  credentialIv: string;
  credentialAuthTag: string;
  expiresAt: Date | null;
}

interface TokenPayload {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  scope?: string;
  token_type?: string;
  expires_at?: number;
  [key: string]: unknown;
}

@Injectable()
export class ProductionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly queue: QueueService,
  ) {}

  async register(
    input: { email?: string; displayName?: string; password?: string },
    meta: { userAgent?: string; ip?: string },
  ) {
    const email = input.email?.trim().toLowerCase();
    const displayName = input.displayName?.trim();
    if (!email || !displayName || !input.password) {
      throw new BadRequestException(
        "email, displayName and password are required",
      );
    }

    const existing = await this.prisma.$queryRaw<UserRow[]>`
      SELECT id,email,"displayName","passwordHash","disabledAt"
      FROM "User" WHERE email=${email} LIMIT 1
    `;
    if (existing.length) {
      throw new BadRequestException("Email is already registered");
    }

    const passwordHash = await hashPassword(input.password);
    const userId = randomUUID();
    const workspaceId = randomUUID();
    const slugBase =
      email
        .split("@")[0]
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase() || "workspace";
    const slug = `${slugBase}-${workspaceId.slice(0, 8)}`;

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "User" (id,email,"displayName","passwordHash","createdAt","updatedAt")
        VALUES (${userId}::uuid,${email},${displayName},${passwordHash},NOW(),NOW())
      `;
      await tx.$executeRaw`
        INSERT INTO "Workspace" (id,name,slug,"createdAt","updatedAt")
        VALUES (${workspaceId}::uuid,${`${displayName}'s workspace`},${slug},NOW(),NOW())
      `;
      await tx.$executeRaw`
        INSERT INTO "WorkspaceMember" (id,"workspaceId","userId",role,"createdAt")
        VALUES (${randomUUID()}::uuid,${workspaceId}::uuid,${userId}::uuid,'OWNER',NOW())
      `;
    });

    return this.issueSession(
      { id: userId, email, displayName },
      meta,
      undefined,
      workspaceId,
    );
  }

  async login(
    input: { email?: string; password?: string },
    meta: { userAgent?: string; ip?: string },
  ) {
    const email = input.email?.trim().toLowerCase();
    if (!email || !input.password) {
      throw new BadRequestException("email and password are required");
    }
    const rows = await this.prisma.$queryRaw<UserRow[]>`
      SELECT id,email,"displayName","passwordHash","disabledAt"
      FROM "User" WHERE email=${email} LIMIT 1
    `;
    const user = rows[0];
    if (
      !user?.passwordHash ||
      user.disabledAt ||
      !(await verifyPassword(input.password, user.passwordHash))
    ) {
      throw new UnauthorizedException("Invalid credentials");
    }
    return this.issueSession(user, meta);
  }

  private async issueSession(
    user: Pick<UserRow, "id" | "email" | "displayName">,
    meta: { userAgent?: string; ip?: string },
    familyId: string = randomUUID(),
    knownWorkspaceId?: string,
  ) {
    const refreshToken = randomToken();
    const refreshHash = tokenHash(refreshToken);
    const sessionId = randomUUID();
    const expiresAt = new Date(
      Date.now() + Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30) * 86_400_000,
    );
    await this.prisma.$executeRaw`
      INSERT INTO "AuthSession"
        (id,"userId","familyId","tokenHash","userAgent","ipAddress","expiresAt")
      VALUES
        (${sessionId}::uuid,${user.id}::uuid,${familyId}::uuid,${refreshHash},${meta.userAgent ?? null},${meta.ip ?? null},${expiresAt})
    `;

    const workspaceId =
      knownWorkspaceId ??
      (
        await this.prisma.$queryRaw<{ workspaceId: string }[]>`
          SELECT "workspaceId" FROM "WorkspaceMember"
          WHERE "userId"=${user.id}::uuid
          ORDER BY "createdAt" ASC LIMIT 1
        `
      )[0]?.workspaceId;

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

  async refresh(
    refreshToken: string | undefined,
    meta: { userAgent?: string; ip?: string },
  ) {
    if (!refreshToken) {
      throw new UnauthorizedException("refreshToken is required");
    }
    const currentHash = tokenHash(refreshToken);
    const sessions = await this.prisma.$queryRaw<SessionRow[]>`
      SELECT s.id,s."userId",s."familyId",s."replacedByHash",s."expiresAt",
             s."revokedAt",u.email,u."displayName"
      FROM "AuthSession" s
      JOIN "User" u ON u.id=s."userId"
      WHERE s."tokenHash"=${currentHash}
      LIMIT 1
    `;
    const current = sessions[0];
    if (!current) throw new UnauthorizedException("Invalid refresh token");

    if (current.replacedByHash || current.revokedAt) {
      await this.revokeFamily(current.familyId);
      throw new UnauthorizedException(
        "Refresh token reuse detected; session family revoked",
      );
    }
    if (new Date(current.expiresAt) <= new Date()) {
      throw new UnauthorizedException("Refresh token expired");
    }

    const nextToken = randomToken();
    const nextHash = tokenHash(nextToken);
    const nextSessionId = randomUUID();
    const expiresAt = new Date(
      Date.now() + Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30) * 86_400_000,
    );

    const rotated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.$queryRaw<{ id: string }[]>`
        UPDATE "AuthSession"
        SET "replacedByHash"=${nextHash},"lastUsedAt"=NOW(),"revokedAt"=NOW()
        WHERE id=${current.id}::uuid
          AND "replacedByHash" IS NULL
          AND "revokedAt" IS NULL
        RETURNING id
      `;
      if (!claimed.length) return false;
      await tx.$executeRaw`
        INSERT INTO "AuthSession"
          (id,"userId","familyId","tokenHash","userAgent","ipAddress","expiresAt")
        VALUES
          (${nextSessionId}::uuid,${current.userId}::uuid,${current.familyId}::uuid,${nextHash},${meta.userAgent ?? null},${meta.ip ?? null},${expiresAt})
      `;
      return true;
    });

    if (!rotated) {
      await this.revokeFamily(current.familyId);
      throw new UnauthorizedException(
        "Refresh token reuse detected; session family revoked",
      );
    }

    const workspaceId = (
      await this.prisma.$queryRaw<{ workspaceId: string }[]>`
        SELECT "workspaceId" FROM "WorkspaceMember"
        WHERE "userId"=${current.userId}::uuid
        ORDER BY "createdAt" ASC LIMIT 1
      `
    )[0]?.workspaceId;

    return {
      accessToken: signAccessToken({
        userId: current.userId,
        email: current.email,
        sessionId: nextSessionId,
      }),
      refreshToken: nextToken,
      expiresIn: Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 900),
      user: {
        id: current.userId,
        email: current.email,
        displayName: current.displayName,
        workspaceId,
      },
    };
  }

  private async revokeFamily(familyId: string) {
    await this.prisma.$executeRaw`
      UPDATE "AuthSession"
      SET "revokedAt"=COALESCE("revokedAt",NOW())
      WHERE "familyId"=${familyId}::uuid
    `;
  }

  async logout(userId: string, sessionId: string) {
    await this.prisma.$executeRaw`
      UPDATE "AuthSession"
      SET "revokedAt"=COALESCE("revokedAt",NOW())
      WHERE id=${sessionId}::uuid AND "userId"=${userId}::uuid
    `;
    return { success: true };
  }

  async invite(
    workspaceId: string,
    invitedByUserId: string,
    input: { email?: string; role?: string },
  ) {
    const email = input.email?.trim().toLowerCase();
    const role = ["ADMIN", "MEMBER", "VIEWER"].includes(input.role ?? "")
      ? input.role!
      : "MEMBER";
    if (!email) throw new BadRequestException("email is required");

    const allowed = await this.prisma.$queryRaw<{ role: string }[]>`
      SELECT role::text FROM "WorkspaceMember"
      WHERE "workspaceId"=${workspaceId}::uuid
        AND "userId"=${invitedByUserId}::uuid
      LIMIT 1
    `;
    if (!["OWNER", "ADMIN"].includes(allowed[0]?.role ?? "")) {
      throw new ForbiddenException("Only owners and admins can invite members");
    }

    const token = randomToken();
    const expiresAt = new Date(Date.now() + 7 * 86_400_000);
    await this.prisma.$executeRaw`
      INSERT INTO "WorkspaceInvitation"
        (id,"workspaceId",email,role,"tokenHash","invitedByUserId","expiresAt")
      VALUES
        (${randomUUID()}::uuid,${workspaceId}::uuid,${email},${role}::"WorkspaceRole",${tokenHash(token)},${invitedByUserId}::uuid,${expiresAt})
    `;

    const appUrl = process.env.PUBLIC_APP_URL ?? "http://localhost:3000";
    const inviteUrl = `${appUrl}/invite?token=${encodeURIComponent(token)}`;
    await this.sendEmail(
      email,
      "You are invited to LeadSignal",
      `<p>You were invited to a LeadSignal workspace.</p><p><a href="${inviteUrl}">Accept invitation</a></p>`,
    );
    return {
      success: true,
      ...(process.env.NODE_ENV === "production" ? {} : { inviteUrl, token }),
    };
  }

  async acceptInvitation(token: string | undefined, userId: string) {
    if (!token) throw new BadRequestException("token is required");
    const rows = await this.prisma.$queryRaw<
      {
        id: string;
        workspaceId: string;
        email: string;
        role: string;
        userEmail: string;
      }[]
    >`
      UPDATE "WorkspaceInvitation" i
      SET "acceptedAt"=NOW()
      FROM "User" u
      WHERE i."tokenHash"=${tokenHash(token)}
        AND u.id=${userId}::uuid
        AND i."acceptedAt" IS NULL
        AND i."revokedAt" IS NULL
        AND i."expiresAt" > NOW()
      RETURNING i.id,i."workspaceId",i.email,i.role::text,u.email AS "userEmail"
    `;
    const invitation = rows[0];
    if (!invitation) {
      throw new NotFoundException(
        "Invitation is invalid, expired or already used",
      );
    }
    if (invitation.email !== invitation.userEmail.toLowerCase()) {
      await this.prisma.$executeRaw`
        UPDATE "WorkspaceInvitation" SET "acceptedAt"=NULL
        WHERE id=${invitation.id}::uuid
      `;
      throw new ForbiddenException(
        "Invitation email does not match authenticated user",
      );
    }

    await this.prisma.$executeRaw`
      INSERT INTO "WorkspaceMember"
        (id,"workspaceId","userId",role,"createdAt")
      VALUES
        (${randomUUID()}::uuid,${invitation.workspaceId}::uuid,${userId}::uuid,${invitation.role}::"WorkspaceRole",NOW())
      ON CONFLICT ("workspaceId","userId")
      DO UPDATE SET role=EXCLUDED.role
    `;
    return { success: true, workspaceId: invitation.workspaceId };
  }

  async oauthStart(provider: string, workspaceId: string, userId: string) {
    const normalized = provider.toLowerCase();
    if (!["github", "google"].includes(normalized)) {
      return {
        provider: normalized,
        mode: "API_KEY_ONLY",
        message:
          "This provider does not expose delegated OAuth for third-party API access.",
      };
    }

    const state = randomToken(32);
    const { verifier, challenge } = createPkce();
    const apiUrl = process.env.PUBLIC_API_URL ?? "http://localhost:4000/api";
    const redirectUri = `${apiUrl}/connections/${normalized}/complete`;
    await this.prisma.$executeRaw`
      INSERT INTO "OAuthState"
        (id,"stateHash",provider,"workspaceId","userId","redirectUri","codeVerifier","expiresAt")
      VALUES
        (${randomUUID()}::uuid,${tokenHash(state)},${normalized},${workspaceId}::uuid,${userId}::uuid,${redirectUri},${verifier},${new Date(Date.now() + 600_000)})
    `;

    let authorizationUrl: URL;
    if (normalized === "github") {
      authorizationUrl = new URL("https://github.com/login/oauth/authorize");
      authorizationUrl.search = new URLSearchParams({
        client_id: this.required("GITHUB_OAUTH_CLIENT_ID"),
        redirect_uri: redirectUri,
        state,
        scope: "read:user models:read",
      }).toString();
    } else {
      authorizationUrl = new URL(
        "https://accounts.google.com/o/oauth2/v2/auth",
      );
      authorizationUrl.search = new URLSearchParams({
        client_id: this.required("GOOGLE_OAUTH_CLIENT_ID"),
        redirect_uri: redirectUri,
        state,
        response_type: "code",
        access_type: "offline",
        prompt: "consent",
        scope: "openid email https://www.googleapis.com/auth/cloud-platform",
        code_challenge: challenge,
        code_challenge_method: "S256",
      }).toString();
    }
    return {
      provider: normalized,
      mode: "OAUTH",
      authorizationUrl: authorizationUrl.toString(),
    };
  }

  async oauthCallback(
    provider: string,
    code: string | undefined,
    state: string | undefined,
  ) {
    if (!code || !state) {
      throw new BadRequestException("code and state are required");
    }
    const normalized = provider.toLowerCase();
    const rows = await this.prisma.$queryRaw<OAuthStateRow[]>`
      UPDATE "OAuthState"
      SET "usedAt"=NOW()
      WHERE "stateHash"=${tokenHash(state)}
        AND provider=${normalized}
        AND "usedAt" IS NULL
        AND "expiresAt" > NOW()
      RETURNING id,provider,"workspaceId","userId","redirectUri","codeVerifier"
    `;
    const saved = rows[0];
    if (!saved?.workspaceId || !saved.userId) {
      throw new BadRequestException("Invalid, expired or replayed OAuth state");
    }

    const tokenData = await this.exchangeOAuthCode(normalized, code, saved);
    await this.storeProviderOAuth(
      normalized,
      saved.workspaceId,
      saved.userId,
      tokenData,
    );
    return {
      success: true,
      provider: normalized,
      workspaceId: saved.workspaceId,
    };
  }

  private async exchangeOAuthCode(
    provider: string,
    code: string,
    state: OAuthStateRow,
  ): Promise<TokenPayload> {
    if (provider === "reddit") {
      // Reddit token exchange
    }
    if (provider === "github") {
      return this.fetchToken(
        "https://github.com/login/oauth/access_token",
        new URLSearchParams({
          client_id: this.required("GITHUB_OAUTH_CLIENT_ID"),
          client_secret: this.required("GITHUB_OAUTH_CLIENT_SECRET"),
          code,
          redirect_uri: state.redirectUri,
        }),
        { Accept: "application/json" },
      );
    }
    return this.fetchToken(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        client_id: this.required("GOOGLE_OAUTH_CLIENT_ID"),
        client_secret: this.required("GOOGLE_OAUTH_CLIENT_SECRET"),
        code,
        redirect_uri: state.redirectUri,
        grant_type: "authorization_code",
        code_verifier: state.codeVerifier ?? "",
      }),
      {},
    );
  }

  private async fetchToken(
    url: string,
    body: URLSearchParams,
    headers: Record<string, string>,
  ): Promise<TokenPayload> {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        ...headers,
      },
      body,
    });
    const data = (await response.json()) as TokenPayload & {
      error?: string;
      error_description?: string;
    };
    if (!response.ok || data.error || !data.access_token) {
      throw new BadRequestException(
        data.error_description ?? data.error ?? "OAuth token exchange failed",
      );
    }
    return data;
  }

  private normalizeTokenPayload(tokenData: TokenPayload): TokenPayload {
    return {
      ...tokenData,
      expires_at: tokenData.expires_in
        ? Date.now() + tokenData.expires_in * 1_000
        : tokenData.expires_at,
    };
  }

  // private async storeReddit(
  //   workspaceId: string,
  //   userId: string,
  //   rawTokenData: TokenPayload,
  // ) {
  //   const tokenData = this.normalizeTokenPayload(rawTokenData);
  //   const encrypted = this.crypto.encrypt(JSON.stringify(tokenData));
  //   await this.prisma.$executeRaw`
  //     INSERT INTO "RedditConnection"
  //       (id,"workspaceId","ownerUserId","encryptedCredential","credentialIv",
  //        "credentialAuthTag","expiresAt",scope,"updatedAt")
  //     VALUES
  //       (${randomUUID()}::uuid,${workspaceId}::uuid,${userId}::uuid,
  //        ${encrypted.encrypted},${encrypted.iv},${encrypted.authTag},
  //        ${tokenData.expires_at ? new Date(tokenData.expires_at) : null},
  //        ${typeof tokenData.scope === 'string' ? tokenData.scope : null},NOW())
  //     ON CONFLICT ("workspaceId") DO UPDATE SET
  //       "ownerUserId"=EXCLUDED."ownerUserId",
  //       "encryptedCredential"=EXCLUDED."encryptedCredential",
  //       "credentialIv"=EXCLUDED."credentialIv",
  //       "credentialAuthTag"=EXCLUDED."credentialAuthTag",
  //       "expiresAt"=EXCLUDED."expiresAt",
  //       scope=EXCLUDED.scope,
  //       status='ACTIVE',
  //       "updatedAt"=NOW()
  //   `;
  // }

  private async storeProviderOAuth(
    provider: string,
    workspaceId: string,
    userId: string,
    rawTokenData: TokenPayload,
  ) {
    const prismaProvider =
      provider === "github" ? LlmProvider.GITHUB_MODELS : LlmProvider.GEMINI;
    const tokenData = this.normalizeTokenPayload(rawTokenData);
    const access = this.crypto.encrypt(tokenData.access_token);
    const existing = await this.prisma.llmConnection.findFirst({
      where: {
        workspaceId,
        ownerUserId: userId,
        provider: prismaProvider,
        accountLabel: "OAuth",
        deletedAt: null,
      },
    });
    const connection = existing
      ? await this.prisma.llmConnection.update({
          where: { id: existing.id },
          data: {
            status: "ACTIVE",
            poolEnabled: true,
            encryptedCredential: access.encrypted,
            credentialIv: access.iv,
            credentialAuthTag: access.authTag,
            lastVerifiedAt: new Date(),
          },
        })
      : await this.prisma.llmConnection.create({
          data: {
            workspaceId,
            ownerUserId: userId,
            provider: prismaProvider,
            name: `${provider} OAuth`,
            accountLabel: "OAuth",
            status: "ACTIVE",
            poolEnabled: true,
            encryptedCredential: access.encrypted,
            credentialIv: access.iv,
            credentialAuthTag: access.authTag,
            lastVerifiedAt: new Date(),
            models: {
              create: {
                model:
                  provider === "github"
                    ? (process.env.GITHUB_MODELS_DEFAULT_MODEL ??
                      "openai/gpt-4.1-mini")
                    : (process.env.GEMINI_DEFAULT_MODEL ?? "gemini-2.5-flash"),
              },
            },
          },
        });

    const encrypted = this.crypto.encrypt(JSON.stringify(tokenData));
    await this.prisma.$executeRaw`
      INSERT INTO "ProviderOAuthCredential"
        (id,"connectionId",provider,"encryptedCredential","credentialIv",
         "credentialAuthTag","expiresAt",scope,"updatedAt")
      VALUES
        (${randomUUID()}::uuid,${connection.id}::uuid,${prismaProvider}::"LlmProvider",
         ${encrypted.encrypted},${encrypted.iv},${encrypted.authTag},
         ${tokenData.expires_at ? new Date(tokenData.expires_at) : null},
         ${typeof tokenData.scope === "string" ? tokenData.scope : null},NOW())
      ON CONFLICT ("connectionId") DO UPDATE SET
        "encryptedCredential"=EXCLUDED."encryptedCredential",
        "credentialIv"=EXCLUDED."credentialIv",
        "credentialAuthTag"=EXCLUDED."credentialAuthTag",
        "expiresAt"=EXCLUDED."expiresAt",
        scope=EXCLUDED.scope,
        "updatedAt"=NOW()
    `;
  }

  async getFreshProviderCredential(
    connectionId: string,
  ): Promise<string | undefined> {
    const rows = await this.prisma.$queryRaw<OAuthCredentialRow[]>`
      SELECT id,"connectionId",provider,"encryptedCredential","credentialIv",
             "credentialAuthTag","expiresAt"
      FROM "ProviderOAuthCredential"
      WHERE "connectionId"=${connectionId}::uuid
      LIMIT 1
    `;
    const stored = rows[0];
    if (!stored) return undefined;

    let tokenData = JSON.parse(
      this.crypto.decrypt(
        stored.encryptedCredential,
        stored.credentialIv,
        stored.credentialAuthTag,
      ),
    ) as TokenPayload;
    const expiresAt = tokenData.expires_at ?? stored.expiresAt?.getTime();
    if (!expiresAt || expiresAt > Date.now() + 120_000) {
      return tokenData.access_token;
    }
    if (!tokenData.refresh_token) {
      throw new UnauthorizedException(
        `OAuth token for ${stored.provider} expired and has no refresh token`,
      );
    }

    let refreshed: TokenPayload;
    if (stored.provider === LlmProvider.GEMINI) {
      refreshed = await this.fetchToken(
        "https://oauth2.googleapis.com/token",
        new URLSearchParams({
          client_id: this.required("GOOGLE_OAUTH_CLIENT_ID"),
          client_secret: this.required("GOOGLE_OAUTH_CLIENT_SECRET"),
          grant_type: "refresh_token",
          refresh_token: tokenData.refresh_token,
        }),
        {},
      );
    } else if (stored.provider === LlmProvider.GITHUB_MODELS) {
      refreshed = await this.fetchToken(
        "https://github.com/login/oauth/access_token",
        new URLSearchParams({
          client_id: this.required("GITHUB_OAUTH_CLIENT_ID"),
          client_secret: this.required("GITHUB_OAUTH_CLIENT_SECRET"),
          grant_type: "refresh_token",
          refresh_token: tokenData.refresh_token,
        }),
        { Accept: "application/json" },
      );
    } else {
      return tokenData.access_token;
    }

    tokenData = this.normalizeTokenPayload({
      ...tokenData,
      ...refreshed,
      refresh_token: refreshed.refresh_token ?? tokenData.refresh_token,
    });
    const encrypted = this.crypto.encrypt(JSON.stringify(tokenData));
    const access = this.crypto.encrypt(tokenData.access_token);
    await this.prisma.$transaction([
      this.prisma.$executeRaw`
        UPDATE "ProviderOAuthCredential" SET
          "encryptedCredential"=${encrypted.encrypted},
          "credentialIv"=${encrypted.iv},
          "credentialAuthTag"=${encrypted.authTag},
          "expiresAt"=${tokenData.expires_at ? new Date(tokenData.expires_at) : null},
          "updatedAt"=NOW()
        WHERE id=${stored.id}::uuid
      `,
      this.prisma.llmConnection.update({
        where: { id: connectionId },
        data: {
          encryptedCredential: access.encrypted,
          credentialIv: access.iv,
          credentialAuthTag: access.authTag,
          lastVerifiedAt: new Date(),
          status: "ACTIVE",
        },
      }),
    ]);
    return tokenData.access_token;
  }

  // async collectReddit(): Promise<{ workspaces: number; posts: number }> {
  //   const connections = await this.prisma.$queryRaw<any[]>`
  //     SELECT * FROM "RedditConnection" WHERE status='ACTIVE'
  //   `;
  //   let posts = 0;
  //   for (const connection of connections) {
  //     try {
  //       const credentials = JSON.parse(
  //         this.crypto.decrypt(
  //           connection.encryptedCredential,
  //           connection.credentialIv,
  //           connection.credentialAuthTag,
  //         ),
  //       ) as TokenPayload;
  //       const accessToken = await this.redditAccessToken(
  //         credentials,
  //         connection.workspaceId,
  //         connection.ownerUserId,
  //       );
  //       const sources = await this.prisma.redditSource.findMany({
  //         where: { workspaceId: connection.workspaceId, enabled: true },
  //       });
  //       for (const source of sources) {
  //         const endpoint = source.subreddit
  //           ? `https://oauth.reddit.com/r/${encodeURIComponent(source.subreddit)}/new?limit=50`
  //           : `https://oauth.reddit.com/search?q=${encodeURIComponent(source.searchQuery ?? '')}&sort=new&limit=50`;
  //         const response = await fetch(endpoint, {
  //           headers: {
  //             Authorization: `Bearer ${accessToken}`,
  //             'User-Agent':
  //               process.env.REDDIT_USER_AGENT ?? 'LeadSignal/1.0',
  //           },
  //         });
  //         if (!response.ok) throw new Error(`Reddit ${response.status}`);
  //         const payload = (await response.json()) as any;
  //         for (const item of payload.data?.children ?? []) {
  //           const value = item.data;
  //           const post = await this.prisma.redditPost.upsert({
  //             where: { externalPostId: value.name },
  //             update: {
  //               score: value.score ?? 0,
  //               commentCount: value.num_comments ?? 0,
  //             },
  //             create: {
  //               externalPostId: value.name,
  //               subreddit: value.subreddit,
  //               authorUsername: value.author,
  //               title: value.title,
  //               body: value.selftext ?? '',
  //               permalink: `https://reddit.com${value.permalink}`,
  //               score: value.score ?? 0,
  //               commentCount: value.num_comments ?? 0,
  //               postedAt: new Date(
  //                 (value.created_utc ?? Date.now() / 1_000) * 1_000,
  //               ),
  //             },
  //           });
  //           await this.prisma.postDiscovery.upsert({
  //             where: {
  //               workspaceId_postId_sourceId: {
  //                 workspaceId: connection.workspaceId,
  //                 postId: post.id,
  //                 sourceId: source.id,
  //               },
  //             },
  //             update: {},
  //             create: {
  //               workspaceId: connection.workspaceId,
  //               postId: post.id,
  //               sourceId: source.id,
  //             },
  //           });
  //           await this.queue.enqueueClassification(
  //             connection.workspaceId,
  //             post.id,
  //           );
  //           posts++;
  //         }
  //       }
  //       await this.prisma.$executeRaw`
  //         UPDATE "RedditConnection"
  //         SET "lastCollectedAt"=NOW(),"lastError"=NULL,"updatedAt"=NOW()
  //         WHERE id=${connection.id}::uuid
  //       `;
  //     } catch (error) {
  //       await this.prisma.$executeRaw`
  //         UPDATE "RedditConnection"
  //         SET "lastError"=${String(error).slice(0, 1000)},"updatedAt"=NOW()
  //         WHERE id=${connection.id}::uuid
  //       `;
  //     }
  //   }
  //   return { workspaces: connections.length, posts };
  // }

  // private async redditAccessToken(
  //   tokenData: TokenPayload,
  //   workspaceId: string,
  //   ownerUserId: string,
  // ) {
  //   if (
  //     tokenData.access_token &&
  //     (!tokenData.expires_at || tokenData.expires_at > Date.now() + 60_000)
  //   ) {
  //     return tokenData.access_token;
  //   }
  //   if (!tokenData.refresh_token) return tokenData.access_token;

  //   const basic = Buffer.from(
  //     `${this.required('REDDIT_CLIENT_ID')}:${this.required('REDDIT_CLIENT_SECRET')}`,
  //   ).toString('base64');
  //   const refreshed = await this.fetchToken(
  //     'https://www.reddit.com/api/v1/access_token',
  //     new URLSearchParams({
  //       grant_type: 'refresh_token',
  //       refresh_token: tokenData.refresh_token,
  //     }),
  //     {
  //       Authorization: `Basic ${basic}`,
  //       'User-Agent': process.env.REDDIT_USER_AGENT ?? 'LeadSignal/1.0',
  //     },
  //   );
  //   const merged = this.normalizeTokenPayload({
  //     ...tokenData,
  //     ...refreshed,
  //     refresh_token: tokenData.refresh_token,
  //   });
  //   await this.storeReddit(workspaceId, ownerUserId, merged);
  //   return merged.access_token;
  // }

  private required(name: string) {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is required`);
    return value;
  }

  private async sendEmail(to: string, subject: string, html: string) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("RESEND_API_KEY is required in production");
      }
      console.log({ to, subject, html });
      return;
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from:
          process.env.INVITATION_FROM_EMAIL ??
          "LeadSignal <noreply@example.com>",
        to: [to],
        subject,
        html,
      }),
    });
    if (!response.ok) {
      throw new Error(`Email delivery failed: ${response.status}`);
    }
  }
}
