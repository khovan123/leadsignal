import 'dotenv/config';
import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import type { FastifyRequest } from 'fastify';
import { AppModule } from './app.module';
import { SecretsService } from './secrets/secrets.service';
import { SessionService } from './auth/session.service';
import type { AuthenticatedUser } from './auth/decorators';

function loadSecretFiles() {
  for (const name of ['DATABASE_URL', 'VALKEY_URL', 'JWT_ACCESS_SECRET', 'CREDENTIAL_ENCRYPTION_KEY', 'SMTP_URL', 'REDDIT_CLIENT_SECRET', 'GITHUB_OAUTH_CLIENT_SECRET', 'GOOGLE_OAUTH_CLIENT_SECRET']) {
    if (process.env[name]) continue;
    const file = process.env[`${name}_FILE`];
    if (file) process.env[name] = readFileSync(file, 'utf8').trim();
  }
}

function publicRequest(path: string) {
  return path === '/api/auth/refresh' || path === '/api/auth/logout' || path === '/api/health' || path.startsWith('/api/oauth/app/') || path.startsWith('/api/oauth/reddit/callback') || (path.startsWith('/api/oauth/llm/') && path.endsWith('/callback')) || path.startsWith('/docs');
}

async function bootstrap() {
  loadSecretFiles();
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ logger: true, trustProxy: process.env.TRUST_PROXY === 'true', bodyLimit: 1024 * 1024 }));
  app.get(SecretsService).assertProduction();
  await app.register(cookie);
  await app.register(cors, { origin: (process.env.WEB_ORIGIN ?? process.env.APP_URL ?? 'http://localhost:3000').split(',').map((value) => value.trim()), credentials: true });
  const sessions = app.get(SessionService);
  app.getHttpAdapter().getInstance().addHook('onRequest', async (request: FastifyRequest & { user?: AuthenticatedUser; cookies?: Record<string, string> }, reply: { code(status: number): { send(body: unknown): Promise<void> } }) => {
    const path = request.url.split('?')[0] ?? request.url;
    if (!path.startsWith('/api') || publicRequest(path)) return;
    try { request.user = await sessions.authenticate(request); }
    catch { await reply.code(401).send({ statusCode: 401, message: 'Authentication required' }); }
  });
  app.setGlobalPrefix('api');
  const config = new DocumentBuilder().setTitle('LeadSignal API').setVersion('0.2.0').addBearerAuth().build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  await app.listen(Number(process.env.API_PORT ?? 4000), '0.0.0.0');
}
bootstrap();
