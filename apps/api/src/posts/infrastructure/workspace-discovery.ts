import { randomUUID } from 'node:crypto';
import type { PrismaService } from '../../database/prisma.service';

export async function registerWorkspacePostDiscovery(
  prisma: PrismaService,
  workspaceId: string,
  postId: string,
  sourceId: string,
): Promise<boolean> {
  const inserted = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO "PostDiscovery" (
      id,
      "workspaceId",
      "postId",
      "sourceId",
      "discoveredAt"
    ) VALUES (
      ${randomUUID()}::uuid,
      ${workspaceId}::uuid,
      ${postId}::uuid,
      ${sourceId}::uuid,
      NOW()
    )
    ON CONFLICT ("workspaceId", "postId") DO NOTHING
    RETURNING id
  `;

  if (inserted.length > 0) return true;

  await prisma.$executeRaw`
    UPDATE "PostDiscovery"
    SET
      "discoveredAt"=NOW(),
      "sourceId"=COALESCE("sourceId", ${sourceId}::uuid)
    WHERE "workspaceId"=${workspaceId}::uuid
      AND "postId"=${postId}::uuid
  `;
  return false;
}
