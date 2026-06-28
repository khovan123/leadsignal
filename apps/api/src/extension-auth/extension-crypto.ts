import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { createPublicKey, verify as verifySignature } from 'node:crypto';

const FORBIDDEN_CREDENTIAL_KEYS = new Set([
  'authorization',
  'cookie',
  'cookies',
  'localstorage',
  'sessionstorage',
  'reddit_session',
  'session_tracker',
  'loid',
  'token',
  'accesstoken',
  'refreshtoken',
  'csrftoken',
]);

export interface ExtensionPublicJwk {
  kty: 'EC';
  crv: 'P-256';
  x: string;
  y: string;
  ext?: boolean;
  key_ops?: string[];
}

export function validateExtensionPublicKey(value: unknown): ExtensionPublicJwk {
  if (!value || typeof value !== 'object') {
    throw new BadRequestException('publicKeyJwk is required');
  }
  const jwk = value as Record<string, unknown>;
  if (
    jwk.kty !== 'EC' ||
    jwk.crv !== 'P-256' ||
    typeof jwk.x !== 'string' ||
    typeof jwk.y !== 'string' ||
    jwk.x.length < 40 ||
    jwk.y.length < 40
  ) {
    throw new BadRequestException('Only ECDSA P-256 public keys are supported');
  }
  return {
    kty: 'EC',
    crv: 'P-256',
    x: jwk.x,
    y: jwk.y,
    ext: true,
    key_ops: ['verify'],
  };
}

export function verifyExtensionSignature(
  publicKeyJwk: unknown,
  message: string,
  signature: string,
): void {
  const jwk = validateExtensionPublicKey(publicKeyJwk);
  let signatureBytes: Buffer;
  try {
    signatureBytes = Buffer.from(signature, 'base64url');
  } catch {
    throw new UnauthorizedException('Malformed extension signature');
  }
  if (signatureBytes.length !== 64) {
    throw new UnauthorizedException('Malformed extension signature');
  }
  const key = createPublicKey({ key: jwk, format: 'jwk' });
  const valid = verifySignature(
    'sha256',
    Buffer.from(message, 'utf8'),
    { key, dsaEncoding: 'ieee-p1363' },
    signatureBytes,
  );
  if (!valid) throw new UnauthorizedException('Invalid extension signature');
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, child]) => child !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries
    .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
    .join(',')}}`;
}

export function assertNoCredentialFields(value: unknown, path = 'payload'): void {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.replace(/[-_]/g, '').toLowerCase();
    if (FORBIDDEN_CREDENTIAL_KEYS.has(normalized)) {
      throw new BadRequestException(`Credential field is not accepted: ${path}.${key}`);
    }
    assertNoCredentialFields(child, `${path}.${key}`);
  }
}

export function loginSigningMessage(challengeId: string, nonce: string): string {
  return `LeadSignal extension login v1\n${challengeId}\n${nonce}`;
}

export function ingestionSigningMessage(
  timestamp: string,
  nonce: string,
  batch: unknown,
): string {
  return `LeadSignal extension ingestion v1\n${timestamp}\n${nonce}\n${stableStringify(batch)}`;
}
