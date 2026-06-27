import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EmailStatus, Prisma } from '@prisma/client';
import nodemailer, { type Transporter } from 'nodemailer';
import { PrismaService } from '../database/prisma.service';
import { SecretsService } from '../secrets/secrets.service';

@Injectable()
export class EmailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailService.name);
  private timer?: NodeJS.Timeout;
  private transporter?: Transporter;

  constructor(private readonly prisma: PrismaService, private readonly secrets: SecretsService) {}

  onModuleInit(): void {
    const smtpUrl = this.secrets.get('SMTP_URL');
    if (smtpUrl) this.transporter = nodemailer.createTransport(smtpUrl);
    this.timer = setInterval(() => void this.flush(), 10_000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  enqueue(input: { workspaceId?: string; recipient: string; subject: string; template: string; payload: Record<string, unknown> }) {
    return this.prisma.emailOutbox.create({ data: { workspaceId: input.workspaceId, recipient: input.recipient, subject: input.subject, template: input.template, payload: input.payload as Prisma.InputJsonValue } });
  }

  async flush(): Promise<void> {
    const rows = await this.prisma.emailOutbox.findMany({
      where: {
        attempts: { lt: 8 },
        OR: [
          { status: { in: [EmailStatus.PENDING, EmailStatus.FAILED] }, availableAt: { lte: new Date() } },
          { status: EmailStatus.SENDING, updatedAt: { lte: new Date(Date.now() - 5 * 60_000) } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    for (const row of rows) {
      const claimed = await this.prisma.emailOutbox.updateMany({ where: { id: row.id, status: row.status }, data: { status: EmailStatus.SENDING, attempts: { increment: 1 } } });
      if (!claimed.count) continue;
      try {
        if (!this.transporter) {
          if (process.env.NODE_ENV === 'production') throw new Error('SMTP_URL is not configured');
          this.logger.log(`Email preview to ${row.recipient}: ${JSON.stringify(row.payload)}`);
        } else {
          await this.transporter.sendMail({
            from: this.secrets.get('EMAIL_FROM') ?? 'LeadSignal <noreply@localhost>',
            to: row.recipient,
            subject: row.subject,
            text: this.renderText(row.template, row.payload as Record<string, unknown>),
            html: this.renderHtml(row.template, row.payload as Record<string, unknown>),
          });
        }
        await this.prisma.emailOutbox.update({ where: { id: row.id }, data: { status: EmailStatus.SENT, sentAt: new Date(), lastError: null } });
      } catch (error) {
        const attempts = row.attempts + 1;
        await this.prisma.emailOutbox.update({
          where: { id: row.id },
          data: {
            status: EmailStatus.FAILED,
            lastError: error instanceof Error ? error.message.slice(0, 500) : 'EMAIL_FAILED',
            availableAt: new Date(Date.now() + Math.min(60 * 60_000, 2 ** attempts * 5_000)),
          },
        });
      }
    }
  }

  private renderText(template: string, payload: Record<string, unknown>): string {
    if (template === 'workspace-invitation') return `${payload.inviterName} invited you to ${payload.workspaceName}. Accept: ${payload.acceptUrl}`;
    return JSON.stringify(payload);
  }

  private renderHtml(template: string, payload: Record<string, unknown>): string {
    if (template === 'workspace-invitation') return `<p><strong>${this.escape(String(payload.inviterName))}</strong> invited you to <strong>${this.escape(String(payload.workspaceName))}</strong>.</p><p><a href="${this.escape(String(payload.acceptUrl))}">Accept invitation</a></p>`;
    return `<pre>${this.escape(JSON.stringify(payload, null, 2))}</pre>`;
  }

  private escape(value: string): string {
    const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return value.replace(/[&<>"']/g, (character) => entities[character] ?? character);
  }
}
