import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { resolveRateLimitPolicy } from './rate-limit.policy';
import { RateLimitService } from './rate-limit.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  constructor(private readonly limiter: RateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<any>();
    const response = http.getResponse<any>();
    const policy = resolveRateLimitPolicy(request.method ?? 'GET', request.url ?? '/');
    if (!policy) return true;

    const identity = request.user?.sub
      ? `user:${request.user.sub}`
      : `ip:${request.ip ?? 'unknown'}:${String(request.body?.email ?? '').trim().toLowerCase()}`;
    const subject = createHash('sha256').update(identity).digest('hex');

    try {
      const result = await this.limiter.consume(subject, policy);
      response.header?.('X-RateLimit-Limit', String(policy.limit));
      response.header?.('X-RateLimit-Remaining', String(result.remaining));
      response.header?.('X-RateLimit-Reset', String(result.resetSeconds));
      if (!result.allowed) {
        response.header?.('Retry-After', String(result.resetSeconds));
        throw new HttpException({ message: 'Rate limit exceeded', retryAfter: result.resetSeconds }, HttpStatus.TOO_MANY_REQUESTS);
      }
      return true;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const failOpen = process.env.RATE_LIMIT_FAIL_OPEN !== 'false';
      this.logger.error(`Rate limiter unavailable; failOpen=${failOpen}: ${String(error)}`);
      if (failOpen) return true;
      throw new HttpException('Rate limiter unavailable', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }
}
