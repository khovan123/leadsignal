import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';

@Injectable()
export class PasswordService {
  hash(value: string): Promise<string> { return argon2.hash(value, { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 }); }
  verify(value: string, digest: string): Promise<boolean> { return argon2.verify(digest, value); }
}
