import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { WorkspaceRole } from '@prisma/client';
import { PUBLIC_HANDLER, REQUIRED_WORKSPACE_ROLES } from './metadata';

export type AuthenticatedUser = { id: string; email: string; sessionId: string };
export const Public = () => SetMetadata(PUBLIC_HANDLER, true);
export const WorkspaceRoles = (...roles: WorkspaceRole[]) => SetMetadata(REQUIRED_WORKSPACE_ROLES, roles);
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user);
