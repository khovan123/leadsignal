import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

interface EmailOutboxRow {
  id: string;
  recipient: string;
  subjectLine: string;
  bodyHtml: string;
  attempts: number;
  maxAttempts: number;
}

export function emailRetryDelaySeconds(attempt: number): number {
  return Math.min(3600, 15 * 2 ** Math.max(0, attempt - 1));
}

@Injectable()
export class EmailOutboxService {
  constructor(private readonly prisma: PrismaService) {}

  async processBatch(workerId: string, batchSize = 20) {
    const rows = await this.prisma.$queryRaw<EmailOutboxRow[]>`
      WITH candidates AS (
        SELECT id FROM "EmailOutbox"
        WHERE "sentAt" IS NULL
          AND attempts < "maxAttempts"
          AND "availableAt" <= NOW()
          AND ("lockedAt" IS NULL OR "lockedAt" < NOW() - INTERVAL '5 minutes')
        ORDER BY "createdAt" ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "EmailOutbox" AS email
      SET attempts=email.attempts + 1,
          "lockedAt"=NOW(),
          "lockedBy"=${workerId},
          "updatedAt"=NOW()
      FROM candidates
      WHERE email.id=candidates.id
      RETURNING email.id,email.recipient,email."subjectLine",email."bodyHtml",
                email.attempts,email."maxAttempts"
    `;

    let sent = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        await this.deliver(row);
        await this.prisma.$executeRaw`
          UPDATE "EmailOutbox"
          SET "sentAt"=NOW(),"lockedAt"=NULL,"lockedBy"=NULL,
              "lastError"=NULL,"updatedAt"=NOW()
          WHERE id=${row.id}::uuid AND "lockedBy"=${workerId}
        `;
        sent++;
      } catch (error) {
        const retryAt = new Date(Date.now() + emailRetryDelaySeconds(row.attempts) * 1000);
        await this.prisma.$executeRaw`
          UPDATE "EmailOutbox"
          SET "availableAt"=${retryAt},"lockedAt"=NULL,"lockedBy"=NULL,
              "lastError"=${String(error).slice(0, 1000)},"updatedAt"=NOW()
          WHERE id=${row.id}::uuid AND "lockedBy"=${workerId}
        `;
        failed++;
      }
    }
    return { claimed: rows.length, sent, failed };
  }

  private async deliver(row: EmailOutboxRow): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('RESEND_API_KEY is required in production');
      }
      console.log('Email outbox delivery', { to: row.recipient, subject: row.subjectLine });
      return;
    }
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: process.env.INVITATION_FROM_EMAIL ?? 'LeadSignal <noreply@example.com>',
        to: [row.recipient],
        subject: row.subjectLine,
        html: row.bodyHtml,
      }),
    });
    if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
  }
}
