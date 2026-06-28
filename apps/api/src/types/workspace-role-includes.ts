import type { WorkspaceRole } from '@prisma/client';

declare global {
  interface ReadonlyArray<T> {
    includes(searchElement: T | WorkspaceRole, fromIndex?: number): boolean;
  }
  interface Array<T> {
    includes(searchElement: T | WorkspaceRole, fromIndex?: number): boolean;
  }
}

export {};
