import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

process.env.JWT_ACCESS_SECRET??='e2e-access-secret-value-longer-than-thirty-two-characters';
process.env.CREDENTIAL_ENCRYPTION_KEY??='0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.GITHUB_OAUTH_CLIENT_ID??='e2e-github-client';
process.env.GITHUB_OAUTH_CLIENT_SECRET??='e2e-github-secret';

let app:NestFastifyApplication;
let prisma:PrismaService;
let baseUrl:string;
const suffix=`${Date.now()}-${Math.random().toString(16).slice(2)}`;
const ownerEmail=`owner-${suffix}@example.com`;
const memberEmail=`member-${suffix}@example.com`;
const password='correct horse battery staple';

async function request(path:string,init:RequestInit={}){const response=await fetch(`${baseUrl}/api${path}`,{...init,headers:{'content-type':'application/json',...(init.headers??{})}});const text=await response.text();let body:any=text;try{body=text?JSON.parse(text):null;}catch{}return {response,body};}
function bearer(token:string){return {authorization:`Bearer ${token}`};}

before(async()=>{app=await NestFactory.create<NestFastifyApplication>(AppModule,new FastifyAdapter({logger:false}));app.setGlobalPrefix('api');await app.listen(0,'127.0.0.1');const address=app.getHttpServer().address();if(!address||typeof address==='string')throw new Error('Unable to resolve test server address');baseUrl=`http://127.0.0.1:${address.port}`;prisma=app.get(PrismaService);});
after(async()=>{await app.close();});

let owner:any;
let ownerLogin:any;
let rotated:any;
let member:any;
let invitationToken:string;

test('register creates a user, owner workspace and session',async()=>{const {response,body}=await request('/auth/register',{method:'POST',body:JSON.stringify({email:ownerEmail,displayName:'Owner E2E',password})});assert.equal(response.status,201);assert.ok(body.accessToken);assert.ok(body.refreshToken);assert.ok(body.user.workspaceId);owner=body;});

test('login returns a separate refresh-token family',async()=>{const {response,body}=await request('/auth/login',{method:'POST',body:JSON.stringify({email:ownerEmail,password})});assert.equal(response.status,201);assert.ok(body.accessToken);assert.notEqual(body.refreshToken,owner.refreshToken);ownerLogin=body;});

test('refresh token rotates once',async()=>{const {response,body}=await request('/auth/refresh',{method:'POST',body:JSON.stringify({refreshToken:ownerLogin.refreshToken})});assert.equal(response.status,201);assert.ok(body.accessToken);assert.ok(body.refreshToken);assert.notEqual(body.refreshToken,ownerLogin.refreshToken);rotated=body;});

test('refresh-token reuse revokes the whole family',async()=>{const reused=await request('/auth/refresh',{method:'POST',body:JSON.stringify({refreshToken:ownerLogin.refreshToken})});assert.equal(reused.response.status,401);const descendant=await request('/auth/refresh',{method:'POST',body:JSON.stringify({refreshToken:rotated.refreshToken})});assert.equal(descendant.response.status,401);});

test('workspace guard allows membership and rejects foreign workspaces',async()=>{const allowed=await request(`/workspaces/${owner.user.workspaceId}`,{headers:bearer(owner.accessToken)});assert.equal(allowed.response.status,200);const forbidden=await request(`/workspaces/${randomUUID()}`,{headers:bearer(owner.accessToken)});assert.equal(forbidden.response.status,403);});

test('owner creates an invitation and invited account accepts it once',async()=>{const invited=await request(`/workspaces/${owner.user.workspaceId}/invitations`,{method:'POST',headers:bearer(owner.accessToken),body:JSON.stringify({email:memberEmail,role:'MEMBER'})});assert.equal(invited.response.status,201);assert.ok(invited.body.token);invitationToken=invited.body.token;const registered=await request('/auth/register',{method:'POST',body:JSON.stringify({email:memberEmail,displayName:'Member E2E',password})});assert.equal(registered.response.status,201);member=registered.body;const accepted=await request('/invitations/accept',{method:'POST',headers:bearer(member.accessToken),body:JSON.stringify({token:invitationToken})});assert.equal(accepted.response.status,201);assert.equal(accepted.body.workspaceId,owner.user.workspaceId);const replay=await request('/invitations/accept',{method:'POST',headers:bearer(member.accessToken),body:JSON.stringify({token:invitationToken})});assert.equal(replay.response.status,404);const workspace=await request(`/workspaces/${owner.user.workspaceId}`,{headers:bearer(member.accessToken)});assert.equal(workspace.response.status,200);});

test('expired and replayed OAuth states are rejected before token exchange',async()=>{const expiredStart=await request(`/connections/github/authorize?workspaceId=${owner.user.workspaceId}`,{headers:bearer(owner.accessToken)});assert.equal(expiredStart.response.status,200);const expiredState=new URL(expiredStart.body.authorizationUrl).searchParams.get('state');assert.ok(expiredState);const expiredHash=createHash('sha256').update(expiredState).digest('hex');await prisma.$executeRaw`UPDATE "OAuthState" SET "expiresAt"=NOW()-INTERVAL '1 minute' WHERE "stateHash"=${expiredHash}`;const expired=await request(`/connections/github/complete?code=fake&state=${encodeURIComponent(expiredState)}`);assert.equal(expired.response.status,400);
const replayStart=await request(`/connections/github/authorize?workspaceId=${owner.user.workspaceId}`,{headers:bearer(owner.accessToken)});const replayState=new URL(replayStart.body.authorizationUrl).searchParams.get('state');assert.ok(replayState);const replayHash=createHash('sha256').update(replayState).digest('hex');await prisma.$executeRaw`UPDATE "OAuthState" SET "usedAt"=NOW() WHERE "stateHash"=${replayHash}`;const replay=await request(`/connections/github/complete?code=fake&state=${encodeURIComponent(replayState)}`);assert.equal(replay.response.status,400);});
