import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { QueueService } from '../queue/queue.service';
import { createPkce, hashPassword, randomToken, signAccessToken, tokenHash, verifyPassword } from './security';
import { randomUUID } from 'node:crypto';

interface UserRow { id: string; email: string; displayName: string; passwordHash: string | null; disabledAt: Date | null; }
interface SessionRow { id: string; userId: string; familyId: string; tokenHash: string; replacedByHash: string | null; expiresAt: Date; revokedAt: Date | null; email: string; }
interface OAuthStateRow { id: string; provider: string; workspaceId: string | null; userId: string | null; redirectUri: string; codeVerifier: string | null; expiresAt: Date; usedAt: Date | null; }

@Injectable()
export class ProductionService {
  constructor(private readonly prisma: PrismaService, private readonly crypto: CryptoService, private readonly queue: QueueService) {}

  async register(input: { email?: string; displayName?: string; password?: string }, meta: { userAgent?: string; ip?: string }) {
    const email = input.email?.trim().toLowerCase();
    if (!email || !input.displayName?.trim() || !input.password) throw new BadRequestException('email, displayName and password are required');
    const existing = await this.prisma.$queryRaw<UserRow[]>`SELECT id, email, "displayName", "passwordHash", "disabledAt" FROM "User" WHERE email = ${email} LIMIT 1`;
    if (existing.length) throw new BadRequestException('Email is already registered');
    const passwordHash = await hashPassword(input.password);
    const rows = await this.prisma.$queryRaw<UserRow[]>`INSERT INTO "User" (id,email,"displayName","passwordHash","createdAt","updatedAt") VALUES (${randomUUID()}::uuid,${email},${input.displayName.trim()},${passwordHash},NOW(),NOW()) RETURNING id,email,"displayName","passwordHash","disabledAt"`;
    return this.issueSession(rows[0], meta);
  }

  async login(input: { email?: string; password?: string }, meta: { userAgent?: string; ip?: string }) {
    const email = input.email?.trim().toLowerCase();
    if (!email || !input.password) throw new BadRequestException('email and password are required');
    const rows = await this.prisma.$queryRaw<UserRow[]>`SELECT id,email,"displayName","passwordHash","disabledAt" FROM "User" WHERE email=${email} LIMIT 1`;
    const user = rows[0];
    if (!user?.passwordHash || user.disabledAt || !(await verifyPassword(input.password, user.passwordHash))) throw new UnauthorizedException('Invalid credentials');
    return this.issueSession(user, meta);
  }

  private async issueSession(user: Pick<UserRow, 'id'|'email'|'displayName'>, meta: { userAgent?: string; ip?: string }, familyId = randomUUID()) {
    const refreshToken = randomToken();
    const hash = tokenHash(refreshToken);
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30) * 86_400_000);
    await this.prisma.$executeRaw`INSERT INTO "AuthSession" (id,"userId","familyId","tokenHash","userAgent","ipAddress","expiresAt") VALUES (${id}::uuid,${user.id}::uuid,${familyId}::uuid,${hash},${meta.userAgent ?? null},${meta.ip ?? null},${expiresAt})`;
    return { accessToken: signAccessToken({ userId: user.id, email: user.email, sessionId: id }), refreshToken, expiresIn: Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 900), user: { id: user.id, email: user.email, displayName: user.displayName } };
  }

  async refresh(refreshToken: string | undefined, meta: { userAgent?: string; ip?: string }) {
    if (!refreshToken) throw new UnauthorizedException('refreshToken is required');
    const hash = tokenHash(refreshToken);
    const rows = await this.prisma.$queryRaw<SessionRow[]>`SELECT s.id,s."userId",s."familyId",s."tokenHash",s."replacedByHash",s."expiresAt",s."revokedAt",u.email FROM "AuthSession" s JOIN "User" u ON u.id=s."userId" WHERE s."tokenHash"=${hash} LIMIT 1`;
    const session = rows[0];
    if (!session) throw new UnauthorizedException('Invalid refresh token');
    if (session.replacedByHash || session.revokedAt) {
      await this.prisma.$executeRaw`UPDATE "AuthSession" SET "revokedAt"=COALESCE("revokedAt",NOW()) WHERE "familyId"=${session.familyId}::uuid`;
      throw new UnauthorizedException('Refresh token reuse detected; session family revoked');
    }
    if (new Date(session.expiresAt) <= new Date()) throw new UnauthorizedException('Refresh token expired');
    const userRows = await this.prisma.$queryRaw<UserRow[]>`SELECT id,email,"displayName","passwordHash","disabledAt" FROM "User" WHERE id=${session.userId}::uuid LIMIT 1`;
    const user = userRows[0];
    if (!user || user.disabledAt) throw new UnauthorizedException('User is disabled');
    const next = await this.issueSession(user, meta, session.familyId);
    await this.prisma.$executeRaw`UPDATE "AuthSession" SET "replacedByHash"=${tokenHash(next.refreshToken)},"lastUsedAt"=NOW(),"revokedAt"=NOW() WHERE id=${session.id}::uuid AND "revokedAt" IS NULL`;
    return next;
  }

  async logout(userId: string, sessionId: string) {
    await this.prisma.$executeRaw`UPDATE "AuthSession" SET "revokedAt"=COALESCE("revokedAt",NOW()) WHERE id=${sessionId}::uuid AND "userId"=${userId}::uuid`;
    return { success: true };
  }

  async invite(workspaceId: string, invitedByUserId: string, input: { email?: string; role?: string }) {
    const email = input.email?.trim().toLowerCase();
    const role = ['ADMIN','MEMBER','VIEWER'].includes(input.role ?? '') ? input.role! : 'MEMBER';
    if (!email) throw new BadRequestException('email is required');
    const allowed = await this.prisma.$queryRaw<{role:string}[]>`SELECT role::text FROM "WorkspaceMember" WHERE "workspaceId"=${workspaceId}::uuid AND "userId"=${invitedByUserId}::uuid LIMIT 1`;
    if (!['OWNER','ADMIN'].includes(allowed[0]?.role ?? '')) throw new ForbiddenException('Only owners and admins can invite members');
    const token = randomToken();
    const expiresAt = new Date(Date.now() + 7 * 86_400_000);
    await this.prisma.$executeRaw`INSERT INTO "WorkspaceInvitation" (id,"workspaceId",email,role,"tokenHash","invitedByUserId","expiresAt") VALUES (${randomUUID()}::uuid,${workspaceId}::uuid,${email},${role}::"WorkspaceRole",${tokenHash(token)},${invitedByUserId}::uuid,${expiresAt})`;
    const appUrl = process.env.PUBLIC_APP_URL ?? 'http://localhost:3000';
    const inviteUrl = `${appUrl}/invite?token=${encodeURIComponent(token)}`;
    await this.sendEmail(email, 'You are invited to LeadSignal', `<p>You were invited to a LeadSignal workspace.</p><p><a href="${inviteUrl}">Accept invitation</a></p>`);
    return { success: true, ...(process.env.NODE_ENV === 'production' ? {} : { inviteUrl }) };
  }

  async acceptInvitation(token: string | undefined, userId: string) {
    if (!token) throw new BadRequestException('token is required');
    const rows = await this.prisma.$queryRaw<{id:string;workspaceId:string;email:string;role:string;expiresAt:Date;acceptedAt:Date|null;revokedAt:Date|null;userEmail:string}[]>`SELECT i.id,i."workspaceId",i.email,i.role::text,i."expiresAt",i."acceptedAt",i."revokedAt",u.email AS "userEmail" FROM "WorkspaceInvitation" i JOIN "User" u ON u.id=${userId}::uuid WHERE i."tokenHash"=${tokenHash(token)} LIMIT 1`;
    const invitation = rows[0];
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.acceptedAt || invitation.revokedAt || new Date(invitation.expiresAt) <= new Date()) throw new BadRequestException('Invitation is no longer valid');
    if (invitation.email !== invitation.userEmail.toLowerCase()) throw new ForbiddenException('Invitation email does not match authenticated user');
    await this.prisma.$transaction([
      this.prisma.$executeRaw`INSERT INTO "WorkspaceMember" (id,"workspaceId","userId",role,"createdAt") VALUES (${randomUUID()}::uuid,${invitation.workspaceId}::uuid,${userId}::uuid,${invitation.role}::"WorkspaceRole",NOW()) ON CONFLICT ("workspaceId","userId") DO UPDATE SET role=EXCLUDED.role`,
      this.prisma.$executeRaw`UPDATE "WorkspaceInvitation" SET "acceptedAt"=NOW() WHERE id=${invitation.id}::uuid`,
    ]);
    return { success: true, workspaceId: invitation.workspaceId };
  }

  async oauthStart(provider: string, workspaceId: string, userId: string) {
    const normalized = provider.toLowerCase();
    const supported = ['reddit','github','google'];
    if (!supported.includes(normalized)) return { provider: normalized, mode: 'API_KEY_ONLY', message: 'This provider does not expose delegated OAuth for third-party API access.' };
    const state = randomToken(32); const { verifier, challenge } = createPkce();
    const apiUrl = process.env.PUBLIC_API_URL ?? 'http://localhost:4000/api';
    const redirectUri = `${apiUrl}/oauth/${normalized}/callback`;
    await this.prisma.$executeRaw`INSERT INTO "OAuthState" (id,"stateHash",provider,"workspaceId","userId","redirectUri","codeVerifier","expiresAt") VALUES (${randomUUID()}::uuid,${tokenHash(state)},${normalized},${workspaceId}::uuid,${userId}::uuid,${redirectUri},${verifier},${new Date(Date.now()+600_000)})`;
    let authorizationUrl: URL;
    if (normalized === 'reddit') {
      authorizationUrl = new URL('https://www.reddit.com/api/v1/authorize');
      authorizationUrl.search = new URLSearchParams({ client_id: this.required('REDDIT_CLIENT_ID'), response_type: 'code', state, redirect_uri: redirectUri, duration: 'permanent', scope: 'identity read history' }).toString();
    } else if (normalized === 'github') {
      authorizationUrl = new URL('https://github.com/login/oauth/authorize');
      authorizationUrl.search = new URLSearchParams({ client_id: this.required('GITHUB_OAUTH_CLIENT_ID'), redirect_uri: redirectUri, state, scope: 'read:user models:read' }).toString();
    } else {
      authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authorizationUrl.search = new URLSearchParams({ client_id: this.required('GOOGLE_OAUTH_CLIENT_ID'), redirect_uri: redirectUri, state, response_type: 'code', access_type: 'offline', prompt: 'consent', scope: 'openid email https://www.googleapis.com/auth/cloud-platform', code_challenge: challenge, code_challenge_method: 'S256' }).toString();
    }
    return { provider: normalized, mode: 'OAUTH', authorizationUrl: authorizationUrl.toString() };
  }

  async oauthCallback(provider: string, code: string | undefined, state: string | undefined) {
    if (!code || !state) throw new BadRequestException('code and state are required');
    const rows = await this.prisma.$queryRaw<OAuthStateRow[]>`SELECT id,provider,"workspaceId","userId","redirectUri","codeVerifier","expiresAt","usedAt" FROM "OAuthState" WHERE "stateHash"=${tokenHash(state)} LIMIT 1`;
    const saved = rows[0];
    if (!saved || saved.provider !== provider || saved.usedAt || new Date(saved.expiresAt) <= new Date()) throw new BadRequestException('Invalid or expired OAuth state');
    await this.prisma.$executeRaw`UPDATE "OAuthState" SET "usedAt"=NOW() WHERE id=${saved.id}::uuid`;
    const tokenData = await this.exchangeOAuthCode(provider, code, saved);
    if (provider === 'reddit') await this.storeReddit(saved.workspaceId!, saved.userId!, tokenData);
    else await this.storeProviderOAuth(provider, saved.workspaceId!, saved.userId!, tokenData);
    return { success: true, provider, workspaceId: saved.workspaceId };
  }

  private async exchangeOAuthCode(provider: string, code: string, state: OAuthStateRow): Promise<any> {
    if (provider === 'reddit') {
      const auth = Buffer.from(`${this.required('REDDIT_CLIENT_ID')}:${this.required('REDDIT_CLIENT_SECRET')}`).toString('base64');
      return this.fetchToken('https://www.reddit.com/api/v1/access_token', new URLSearchParams({ grant_type:'authorization_code', code, redirect_uri:state.redirectUri }), { Authorization:`Basic ${auth}`, 'User-Agent':process.env.REDDIT_USER_AGENT ?? 'LeadSignal/1.0' });
    }
    if (provider === 'github') return this.fetchToken('https://github.com/login/oauth/access_token', new URLSearchParams({ client_id:this.required('GITHUB_OAUTH_CLIENT_ID'), client_secret:this.required('GITHUB_OAUTH_CLIENT_SECRET'), code, redirect_uri:state.redirectUri }), { Accept:'application/json' });
    return this.fetchToken('https://oauth2.googleapis.com/token', new URLSearchParams({ client_id:this.required('GOOGLE_OAUTH_CLIENT_ID'), client_secret:this.required('GOOGLE_OAUTH_CLIENT_SECRET'), code, redirect_uri:state.redirectUri, grant_type:'authorization_code', code_verifier:state.codeVerifier ?? '' }), {});
  }

  private async fetchToken(url: string, body: URLSearchParams, headers: Record<string,string>) { const response = await fetch(url,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',...headers},body}); const data=await response.json() as any; if(!response.ok||data.error) throw new BadRequestException(data.error_description ?? data.error ?? 'OAuth token exchange failed'); return data; }

  private async storeReddit(workspaceId: string, userId: string, tokenData: any) { const encrypted=this.crypto.encrypt(JSON.stringify(tokenData)); await this.prisma.$executeRaw`INSERT INTO "RedditConnection" (id,"workspaceId","ownerUserId","encryptedCredential","credentialIv","credentialAuthTag","expiresAt",scope,"updatedAt") VALUES (${randomUUID()}::uuid,${workspaceId}::uuid,${userId}::uuid,${encrypted.encrypted},${encrypted.iv},${encrypted.authTag},${tokenData.expires_in ? new Date(Date.now()+tokenData.expires_in*1000):null},${tokenData.scope ?? null},NOW()) ON CONFLICT ("workspaceId") DO UPDATE SET "ownerUserId"=EXCLUDED."ownerUserId","encryptedCredential"=EXCLUDED."encryptedCredential","credentialIv"=EXCLUDED."credentialIv","credentialAuthTag"=EXCLUDED."credentialAuthTag","expiresAt"=EXCLUDED."expiresAt",scope=EXCLUDED.scope,status='ACTIVE',"updatedAt"=NOW()`; }

  private async storeProviderOAuth(provider: string, workspaceId: string, userId: string, tokenData: any) { const prismaProvider=provider==='github'?'GITHUB_MODELS':'GEMINI'; const encrypted=this.crypto.encrypt(tokenData.access_token); const connection=await this.prisma.llmConnection.create({data:{workspaceId,ownerUserId:userId,provider:prismaProvider as any,name:`${provider} OAuth`,accountLabel:'OAuth',status:'ACTIVE',poolEnabled:true,encryptedCredential:encrypted.encrypted,credentialIv:encrypted.iv,credentialAuthTag:encrypted.authTag,lastVerifiedAt:new Date()}}); const oauthEncrypted=this.crypto.encrypt(JSON.stringify(tokenData)); await this.prisma.$executeRaw`INSERT INTO "ProviderOAuthCredential" (id,"connectionId",provider,"encryptedCredential","credentialIv","credentialAuthTag","expiresAt",scope,"updatedAt") VALUES (${randomUUID()}::uuid,${connection.id}::uuid,${prismaProvider}::"LlmProvider",${oauthEncrypted.encrypted},${oauthEncrypted.iv},${oauthEncrypted.authTag},${tokenData.expires_in ? new Date(Date.now()+tokenData.expires_in*1000):null},${tokenData.scope ?? null},NOW())`; }

  async collectReddit(): Promise<{workspaces:number;posts:number}> {
    const connections=await this.prisma.$queryRaw<any[]>`SELECT * FROM "RedditConnection" WHERE status='ACTIVE'`;
    let posts=0;
    for(const connection of connections){ try { const credentials=JSON.parse(this.crypto.decrypt(connection.encryptedCredential,connection.credentialIv,connection.credentialAuthTag)); const accessToken=await this.redditAccessToken(credentials,connection.workspaceId); const sources=await this.prisma.redditSource.findMany({where:{workspaceId:connection.workspaceId,enabled:true}}); for(const source of sources){ const endpoint=source.subreddit?`https://oauth.reddit.com/r/${encodeURIComponent(source.subreddit)}/new?limit=50`:`https://oauth.reddit.com/search?q=${encodeURIComponent(source.searchQuery ?? '')}&sort=new&limit=50`; const response=await fetch(endpoint,{headers:{Authorization:`Bearer ${accessToken}`,'User-Agent':process.env.REDDIT_USER_AGENT ?? 'LeadSignal/1.0'}}); if(!response.ok) throw new Error(`Reddit ${response.status}`); const payload=await response.json() as any; for(const item of payload.data?.children ?? []){ const p=item.data; const post=await this.prisma.redditPost.upsert({where:{externalPostId:p.name},update:{score:p.score??0,commentCount:p.num_comments??0},create:{externalPostId:p.name,subreddit:p.subreddit,authorUsername:p.author,title:p.title,body:p.selftext??'',permalink:`https://reddit.com${p.permalink}`,score:p.score??0,commentCount:p.num_comments??0,postedAt:new Date((p.created_utc??Date.now()/1000)*1000)}}); const discovery=await this.prisma.postDiscovery.upsert({where:{workspaceId_postId_sourceId:{workspaceId:connection.workspaceId,postId:post.id,sourceId:source.id}},update:{},create:{workspaceId:connection.workspaceId,postId:post.id,sourceId:source.id}}); if(discovery) await this.queue.enqueueClassification(connection.workspaceId,post.id); posts++; } } await this.prisma.$executeRaw`UPDATE "RedditConnection" SET "lastCollectedAt"=NOW(),"lastError"=NULL,"updatedAt"=NOW() WHERE id=${connection.id}::uuid`; } catch(error){ await this.prisma.$executeRaw`UPDATE "RedditConnection" SET "lastError"=${String(error)},"updatedAt"=NOW() WHERE id=${connection.id}::uuid`; } }
    return {workspaces:connections.length,posts};
  }

  private async redditAccessToken(credentials:any,workspaceId:string){ if(credentials.expires_at && credentials.expires_at>Date.now()+60_000) return credentials.access_token; if(!credentials.refresh_token) return credentials.access_token; const auth=Buffer.from(`${this.required('REDDIT_CLIENT_ID')}:${this.required('REDDIT_CLIENT_SECRET')}`).toString('base64'); const refreshed=await this.fetchToken('https://www.reddit.com/api/v1/access_token',new URLSearchParams({grant_type:'refresh_token',refresh_token:credentials.refresh_token}),{Authorization:`Basic ${auth}`,'User-Agent':process.env.REDDIT_USER_AGENT ?? 'LeadSignal/1.0'}); const merged={...credentials,...refreshed,refresh_token:credentials.refresh_token,expires_at:Date.now()+refreshed.expires_in*1000}; await this.storeReddit(workspaceId,(await this.prisma.$queryRaw<any[]>`SELECT "ownerUserId" FROM "RedditConnection" WHERE "workspaceId"=${workspaceId}::uuid`)[0].ownerUserId,merged); return merged.access_token; }

  private required(name:string){ const value=process.env[name]; if(!value) throw new Error(`${name} is required`); return value; }
  private async sendEmail(to:string,subject:string,html:string){ const key=process.env.RESEND_API_KEY; if(!key){ if(process.env.NODE_ENV==='production') throw new Error('RESEND_API_KEY is required in production'); console.log({to,subject,html}); return; } const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify({from:process.env.INVITATION_FROM_EMAIL ?? 'LeadSignal <noreply@example.com>',to:[to],subject,html})}); if(!response.ok) throw new Error(`Email delivery failed: ${response.status}`); }
}
