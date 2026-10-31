import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from './jwt.strategy';

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<{ user: AuthUser }>().user;
});
