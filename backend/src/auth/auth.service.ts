import { createHash, randomBytes } from 'crypto';
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto, RegisterDto, ResetDto } from './auth.dto';
import { AuthUser } from './jwt.strategy';

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private refreshDays() {
    const days = Number(this.config.get<string>('JWT_REFRESH_TTL_DAYS') ?? '30');
    return Number.isFinite(days) && days > 0 ? days : 30;
  }

  private async tokensFor(user: { id: string; email: string; role: Role }, userAgent?: string) {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + this.refreshDays() * 86400000);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt,
        userAgent: userAgent?.slice(0, 240),
      },
    });
    return { accessToken, refreshToken };
  }

  private profile(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    avatarUrl: string | null;
    bio: string | null;
    interests: string[];
    preferredRegions: string[];
    language: string;
    role: Role;
    city: string | null;
    showProfilePublicly: boolean;
    notifyBookings: boolean;
    notifyCompanions: boolean;
    notifyMarketing: boolean;
    telegramHandle: string | null;
    whatsappHandle: string | null;
    deletionRequestedAt: Date | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      interests: user.interests,
      preferredRegions: user.preferredRegions,
      language: user.language,
      role: user.role,
      city: user.city,
      showProfilePublicly: user.showProfilePublicly,
      notifyBookings: user.notifyBookings,
      notifyCompanions: user.notifyCompanions,
      notifyMarketing: user.notifyMarketing,
      telegramHandle: user.telegramHandle,
      whatsappHandle: user.whatsappHandle,
      deletionRequestedAt: user.deletionRequestedAt?.toISOString() ?? null,
    };
  }

  async register(dto: RegisterDto, userAgent?: string) {
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        language: dto.language ?? 'en',
        role: Role.USER,
      },
    });
    const tokens = await this.tokensFor(user, userAgent);
    return { data: { user: this.profile(user), ...tokens } };
  }

  async login(email: string, password: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!user || !valid) {
      throw new UnauthorizedException({
        message: 'Invalid email or password.',
        code: 'AUTH',
      });
    }
    if (user.suspendedAt) {
      throw new UnauthorizedException({ message: 'This account is suspended.', code: 'SUSPENDED' });
    }
    const tokens = await this.tokensFor(user, userAgent);
    return { data: { user: this.profile(user), ...tokens } };
  }

  async refresh(refreshToken: string, userAgent?: string) {
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: true },
    });
    if (!existing || existing.revokedAt || existing.expiresAt.getTime() < Date.now() || existing.user.suspendedAt) {
      throw new UnauthorizedException({ message: 'Sign in again to continue.', code: 'AUTH' });
    }
    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });
    const tokens = await this.tokensFor(existing.user, userAgent);
    return { data: { user: this.profile(existing.user), ...tokens } };
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { data: { ok: true } };
  }

  async forgot(email: string) {
    const generic = {
      message: 'If an account exists, a reset token was created. Email delivery is not configured on this server.',
    };
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) return { data: generic };
    const token = randomBytes(32).toString('base64url');
    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
    const dev = this.config.get<string>('NODE_ENV') !== 'production';
    return { data: dev ? { ...generic, devResetToken: token } : generic };
  }

  async reset(dto: ResetDto) {
    const row = await this.prisma.passwordReset.findUnique({
      where: { tokenHash: hashToken(dto.token) },
    });
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException({ message: 'This reset link is no longer valid.', code: 'RESET' });
    }
    const passwordHash = await bcrypt.hash(dto.password, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
      this.prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      this.prisma.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { data: { ok: true } };
  }

  async changePassword(user: AuthUser, dto: ChangePasswordDto) {
    const row = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const valid = await bcrypt.compare(dto.currentPassword, row.passwordHash);
    if (!valid) {
      throw new UnauthorizedException({ message: 'Current password is incorrect.', code: 'AUTH' });
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, 12) },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { data: { ok: true } };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { data: this.profile(user) };
  }
}
