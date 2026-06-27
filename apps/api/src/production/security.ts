import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function fromBase64url(input: string): Buffer {
  return Buffer.from(input, 'base64url');
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12) throw new Error('Password must contain at least 12 characters');
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${base64url(salt)}$${base64url(derived)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, saltValue, hashValue] = stored.split('$');
  if (algorithm !== 'scrypt' || !saltValue || !hashValue) return false;
  const expected = fromBase64url(hashValue);
  const actual = (await scrypt(password, fromBase64url(saltValue), expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function randomToken(bytes = 48): string {
  return randomBytes(bytes).toString('base64url');
}

export function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface AccessTokenClaims {
  sub: string;
  email: string;
  sid: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

function jwtSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_ACCESS_SECRET must contain at least 32 characters');
  return secret;
}

export function signAccessToken(input: { userId: string; email: string; sessionId: string }): string {
  const now = Math.floor(Date.now() / 1000);
  const ttl = Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 900);
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    sub: input.userId,
    email: input.email,
    sid: input.sessionId,
    iat: now,
    exp: now + ttl,
    iss: process.env.JWT_ISSUER ?? 'leadsignal-api',
    aud: process.env.JWT_AUDIENCE ?? 'leadsignal-web',
  } satisfies AccessTokenClaims));
  const signature = createHmac('sha256', jwtSecret()).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) throw new Error('Malformed access token');
  const expected = createHmac('sha256', jwtSecret()).update(`${header}.${payload}`).digest();
  const actual = fromBase64url(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error('Invalid access token signature');
  const claims = JSON.parse(fromBase64url(payload).toString('utf8')) as AccessTokenClaims;
  const now = Math.floor(Date.now() / 1000);
  if (claims.exp <= now) throw new Error('Access token expired');
  if (claims.iss !== (process.env.JWT_ISSUER ?? 'leadsignal-api')) throw new Error('Invalid token issuer');
  if (claims.aud !== (process.env.JWT_AUDIENCE ?? 'leadsignal-web')) throw new Error('Invalid token audience');
  return claims;
}

export function createPkce(): { verifier: string; challenge: string } {
  const verifier = randomToken(48);
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}
