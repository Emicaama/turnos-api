import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '../../auth/auth-user';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return request.user;
  },
);
