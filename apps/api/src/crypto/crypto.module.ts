import { Global, Module } from '@nestjs/common';
import { SecretsService } from '../secrets/secrets.service';
import { CryptoService } from './crypto.service';

@Global()
@Module({ providers: [SecretsService, CryptoService], exports: [SecretsService, CryptoService] })
export class CryptoModule {}
