import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ListLeadsHandler,
  ListLeadsQuery,
  UpdateLeadStatusCommand,
  UpdateLeadStatusHandler,
} from '../../src/leads/application/leads.use-cases';
import type {
  LeadRecord,
  LeadRepository,
} from '../../src/leads/domain/lead.repository';
import { LeadStatus } from '../../src/leads/domain/lead-status.value-object';
import {
  LoginUserCommand,
  LoginUserHandler,
} from '../../src/identity/application/identity.use-cases';
import type { IdentityPort } from '../../src/identity/application/identity.port';

const lead: LeadRecord = {
  id: 'lead-1',
  workspaceId: 'workspace-1',
  postId: 'post-1',
  classificationId: 'classification-1',
  status: 'NEW',
  priorityScore: 80,
  priorityLevel: 'HIGH',
  assignedToUserId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function leadRepository(overrides: Partial<LeadRepository> = {}): LeadRepository {
  return {
    listByWorkspace: async () => [lead],
    exists: async () => true,
    updateStatus: async (_workspaceId, _leadId, status) => ({
      ...lead,
      status,
    }),
    postExists: async () => true,
    ...overrides,
  };
}

test('LeadStatus accepts domain values and rejects invalid transitions', () => {
  assert.equal(LeadStatus.create('QUALIFIED').value, 'QUALIFIED');
  assert.throws(() => LeadStatus.create('UNKNOWN'));
});

test('ListLeadsHandler delegates to the repository port', async () => {
  const handler = new ListLeadsHandler(leadRepository());
  const result = await handler.execute(new ListLeadsQuery('workspace-1'));
  assert.equal(result.length, 1);
  assert.equal(result[0]?.id, 'lead-1');
});

test('UpdateLeadStatusHandler enforces workspace-scoped existence', async () => {
  const missing = new UpdateLeadStatusHandler(
    leadRepository({ exists: async () => false }),
  );
  await assert.rejects(
    () =>
      missing.execute(
        new UpdateLeadStatusCommand('workspace-1', 'missing', 'QUALIFIED'),
      ),
    /Lead not found/,
  );

  const handler = new UpdateLeadStatusHandler(leadRepository());
  const result = await handler.execute(
    new UpdateLeadStatusCommand('workspace-1', 'lead-1', 'QUALIFIED'),
  );
  assert.equal(result.status, 'QUALIFIED');
});

test('identity command handler depends only on its application port', async () => {
  const calls: unknown[] = [];
  const identity: IdentityPort = {
    register: async () => null,
    login: async (input, metadata) => {
      calls.push({ input, metadata });
      return { accessToken: 'test' };
    },
    refresh: async () => null,
    logout: async () => null,
  };
  const handler = new LoginUserHandler(identity);
  const result = await handler.execute(
    new LoginUserCommand(
      { email: 'member@example.com', password: 'test-password' },
      { ip: '127.0.0.1' },
    ),
  );
  assert.deepEqual(result, { accessToken: 'test' });
  assert.equal(calls.length, 1);
});
