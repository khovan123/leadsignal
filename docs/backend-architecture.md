# Backend architecture

LeadSignal API is a modular monolith. Each business capability is a bounded context and owns its HTTP entry points, application use cases, domain contracts and infrastructure adapters.

## Dependency rule

Dependencies point inward:

```text
presentation -> application -> domain
                       ^
                       |
                infrastructure
```

- `domain` contains value objects, repository contracts and business vocabulary. It does not import NestJS, Prisma, BullMQ or HTTP types.
- `application` contains commands, queries and their handlers. Handlers orchestrate one use case and depend on domain/application ports through injection tokens.
- `infrastructure` implements ports using Prisma, provider SDKs, queues or existing integration services.
- `presentation` contains controllers. Controllers translate HTTP input into commands or queries and call only `CommandBus` or `QueryBus`.

## Bounded contexts

- `identity`: registration, login, refresh rotation and logout.
- `invitations`: workspace invitation creation and acceptance.
- `provider-connections`: Reddit, GitHub and Google OAuth initiation/callback.
- `workspaces`: workspace read models.
- `posts`: manual post ingestion and discovery persistence.
- `leads`: lead queries, status changes and classification dispatch.
- `llm`: member-owned connection commands/queries and LLM routing infrastructure.
- `production`: cross-cutting infrastructure retained during migration, including global guards, token/session implementation, Reddit collection and outbox processing. It exposes no controllers.

## CQRS conventions

- Commands are imperative and may change state: `UpdateLeadStatusCommand`, `RegisterUserCommand`.
- Queries return read models and do not change state: `ListLeadsQuery`, `GetWorkspaceQuery`.
- One handler owns one use case.
- Controllers do not inject Prisma repositories or business services.
- Handlers do not inject `PrismaService` directly. They inject a symbol token such as `LEAD_REPOSITORY`.

## Dependency injection conventions

Every port has:

1. a TypeScript interface;
2. a stable `Symbol` injection token;
3. an infrastructure implementation;
4. module wiring with `useExisting` or `useFactory`.

Example:

```ts
providers: [
  PrismaLeadRepository,
  { provide: LEAD_REPOSITORY, useExisting: PrismaLeadRepository },
]
```

This keeps application handlers testable without PostgreSQL and allows infrastructure replacement without changing use cases.

## Adding a use case

1. Add or reuse domain types and ports.
2. Add one command/query and one handler in `application`.
3. Implement missing port behavior in `infrastructure`.
4. Expose the use case through a thin controller in `presentation`.
5. Register the handler and adapter in the bounded-context module.
6. Add unit tests for domain/application behavior and E2E coverage for the HTTP contract.

## Migration policy

The refactor preserves existing URLs and response shapes. Infrastructure-heavy behavior in the former production service is accessed through ports and adapters first. It can then be extracted incrementally without coupling controllers or handlers to that implementation.
