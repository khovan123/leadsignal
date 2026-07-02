import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CryptoService } from '../crypto/crypto.service';
import { PrismaService } from '../database/prisma.service';
import { saveRedditSession, type RedditSessionCookie } from '../reddit-public/reddit-session-store';
import { tokenHash } from '../production/security';
import type {
  RedditSessionCookieInput,
  SyncRedditSessionInput,
} from './extension-device.types';

@Injectable()
export class RedditSessionSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async sync(input: SyncRedditSessionInput) {
    if (!input.ticket?.trim()) {
      throw new UnauthorizedException('ticket is required');
    }
    const cookies = this.validateCookies(input.cookies);
    const ticket = await this.prisma.extensionLoginTicket.findUnique({
      where: { tokenHash: tokenHash(input.ticket.trim()) },
      include: { device: true },
    });

    if (
      !ticket ||
      ticket.usedAt ||
      ticket.expiresAt <= new Date() ||
      ticket.device.status !== 'ACTIVE' ||
      ticket.device.revokedAt
    ) {
      throw new UnauthorizedException(
        'Session sync ticket is invalid, expired or already used',
      );
    }

    const consumed = await this.prisma.extensionLoginTicket.updateMany({
      where: {
        id: ticket.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) {
      throw new ConflictException('Session sync ticket was already consumed');
    }

    const result = await saveRedditSession(this.crypto, {
      workspaceId: ticket.device.workspaceId,
      deviceId: ticket.device.id,
      cookies,
    });

    await this.prisma.extensionDevice.update({
      where: { id: ticket.device.id },
      data: { lastSeenAt: new Date() },
    });

    return {
      ok: true,
      workspaceId: ticket.device.workspaceId,
      ...result,
    };
  }

  private validateCookies(input: RedditSessionCookieInput[]): RedditSessionCookie[] {
    if (!Array.isArray(input) || input.length === 0) {
      throw new BadRequestException('Reddit cookies are required');
    }
    if (input.length > 100) {
      throw new BadRequestException('Too many Reddit cookies');
    }

    const normalized = input
      .filter((cookie) => cookie && typeof cookie === 'object')
      .map((cookie) => ({
        name: String(cookie.name ?? '').slice(0, 256),
        value: String(cookie.value ?? '').slice(0, 8192),
        domain: String(cookie.domain ?? '.reddit.com').slice(0, 255),
        path: String(cookie.path ?? '/').slice(0, 1024),
        expires:
          typeof cookie.expires === 'number' && Number.isFinite(cookie.expires)
            ? cookie.expires
            : undefined,
        httpOnly: Boolean(cookie.httpOnly),
        secure: cookie.secure !== false,
        sameSite: this.sameSite(cookie.sameSite),
      }))
      .filter((cookie) => cookie.name && cookie.value)
      .filter((cookie) => /(^|\.)reddit\.com$/i.test(cookie.domain.replace(/^\./, '')));

    if (normalized.length === 0) {
      throw new BadRequestException('No valid reddit.com cookies were supplied');
    }

    return normalized;
  }

  private sameSite(value: RedditSessionCookieInput['sameSite']): RedditSessionCookie['sameSite'] {
    const normalized = String(value ?? '').toLowerCase();
    if (normalized === 'strict') return 'Strict';
    if (normalized === 'none' || normalized === 'no_restriction') return 'None';
    return 'Lax';
  }
}
