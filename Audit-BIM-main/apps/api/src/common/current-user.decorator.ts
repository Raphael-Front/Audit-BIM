import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../auth/types';

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as AuthUser | undefined;
  },
);
