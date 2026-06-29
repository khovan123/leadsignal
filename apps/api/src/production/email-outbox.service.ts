import { Injectable } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { PrismaService } from '../database/prisma.service';

interface EmailOutboxRow {
  id: string;
  recipient: string;
  subjectLine: string;
  bodyHtml: string;
  attempts: number;
  maxAttempts: number;
}

export interface SmtpConfiguration {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

export function emailRetryDelaySeconds(attempt: number): number {
  return Math.min(3600, 15 * 2 ** Math.max(0, attempt - 1));
}

export function readSmtpConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): SmtpConfiguration | undefined {
  const user = environment.SMTP_USER?.trim();
  const password = environment.SMTP_PASSWORD?.replace(/\s+/g, '');

  if (!user && !password) return undefined;
  if (!user || !password) {
    throw new Error('SMTP_USER and SMTP_PASSWORD must be configured together');
  }

  const port = Number(environment.SMTP_PORT ?? 465);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be a valid TCP port');
  }

  const secureValue = environment.SMTP_SECURE?.trim().toLowerCase();
  const secure = secureValue === undefined ? port === 465 : secureValue === 'true';
  if (secureValue !== undefined && !['true', 'false'].includes(secureValue)) {
    throw new Error('SMTP_SECURE must be true or false');
  }

  return {
    host: environment.SMTP_HOST?.trim() || 'smtp.gmail.com',
    port,
    secure,
    user,
    password,
    from: environment.INVITATION_FROM_EMAIL?.trim() || `LeadSignal <${user}>`,
  };
}

@Injectable()
export class EmailOutboxService {
  private transporter?: Transporter;

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
    const smtp = readSmtpConfiguration();
    if (!smtp) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('SMTP_USER and SMTP_PASSWORD are required in production');
      }
      console.log('Email outbox delivery', {
        to: row.recipient,
        subject: row.subjectLine,
      });
      return;
    }

    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: {
          user: smtp.user,
          pass: smtp.password,
        },
      });
    }

    await this.transporter.sendMail({
      from: smtp.from,
      to: row.recipient,
      subject: row.subjectLine,
      html: row.bodyHtml,
    });
  }
}
