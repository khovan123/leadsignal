import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';

@Injectable()
export class SecretsService {
  get(name: string): string | undefined {
    const direct = process.env[name]?.trim();
    if (direct) return direct;
    const file = process.env[`${name}_FILE`]?.trim();
    if (!file) return undefined;
    return readFileSync(file, 'utf8').trim();
  }

  require(name: string, minimumLength = 1): string {
    const value = this.get(name);
    if (!value || value.length < minimumLength) throw new Error(`${name} is required and must be at least ${minimumLength} characters`);
    return value;
  }

  assertProduction(): void {
    if (process.env.NODE_ENV !== 'production') return;
    this.require('JWT_ACCESS_SECRET', 32);
    this.require('CREDENTIAL_ENCRYPTION_KEY', 64);
    this.require('APP_URL', 8);
    this.require('API_PUBLIC_URL', 8);
    this.require('SMTP_URL', 8);
  }
}
