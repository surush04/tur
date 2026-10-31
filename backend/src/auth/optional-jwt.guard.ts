import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '../generated/prisma/client';
import { AuthUser } from './jwt.strategy';

@Injectable()
export class OptionalJwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthUser;
    }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return true;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; email: string; role: Role }>(header.slice(7));
      request.user = { id: payload.sub, email: payload.email, role: payload.role };
    } catch {
      return true;
    }
    return true;
  }
}
