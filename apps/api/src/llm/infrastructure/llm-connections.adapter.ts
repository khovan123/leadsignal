import { Inject, Injectable } from '@nestjs/common';
import { LlmService } from '../llm.service';
import type { LlmConnectionsPort } from '../application/llm-connections.port';

@Injectable()
export class LlmConnectionsAdapter implements LlmConnectionsPort {
  constructor(@Inject(LlmService) private readonly service: LlmService) {}

  list(workspaceId: string) {
    return this.service.list(workspaceId);
  }

  create(workspaceId: string, ownerUserId: string, input: unknown) {
    return this.service.create(workspaceId, ownerUserId, input);
  }

  verify(workspaceId: string, ownerUserId: string, id: string) {
    return this.service.verify(workspaceId, ownerUserId, id);
  }

  remove(workspaceId: string, ownerUserId: string, id: string) {
    return this.service.remove(workspaceId, ownerUserId, id);
  }
}
