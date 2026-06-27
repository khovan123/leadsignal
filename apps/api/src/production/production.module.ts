import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ProductionService } from './production.service';
import { ProductionAuthGuard } from './production.guard';

@Module({
  providers: [
    ProductionService,
    { provide: APP_GUARD, useClass: ProductionAuthGuard },
  ],
  exports: [ProductionService],
})
export class ProductionModule {}
