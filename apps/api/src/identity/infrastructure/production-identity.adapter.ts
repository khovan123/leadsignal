import { Injectable } from '@nestjs/common';
import { ProductionService } from '../../production/production.service';
import type {
  IdentityPort,
  LoginInput,
  RegisterInput,
  RequestMetadata,
} from '../application/identity.port';

@Injectable()
export class ProductionIdentityAdapter implements IdentityPort {
  constructor(private readonly production: ProductionService) {}

  register(input: RegisterInput, metadata: RequestMetadata) {
    return this.production.register(input, metadata);
  }

  login(input: LoginInput, metadata: RequestMetadata) {
    return this.production.login(input, metadata);
  }

  refresh(refreshToken: string | undefined, metadata: RequestMetadata) {
    return this.production.refresh(refreshToken, metadata);
  }

  logout(userId: string, sessionId: string) {
    return this.production.logout(userId, sessionId);
  }
}
