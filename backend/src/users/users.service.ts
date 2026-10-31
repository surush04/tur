import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { AccountModeDto, UpdateProfileDto } from './users.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  me(userId: string) {
    return this.auth.me(userId);
  }

  async update(userId: string, dto: UpdateProfileDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName?.trim(),
        lastName: dto.lastName?.trim(),
        phone: dto.phone?.trim(),
        city: dto.city?.trim(),
        bio: dto.bio?.trim(),
        interests: dto.interests?.map((item) => item.trim()).filter(Boolean).slice(0, 12),
        preferredRegions: dto.preferredRegions?.map((item) => item.trim()).filter(Boolean).slice(0, 8),
        language: dto.language,
        showProfilePublicly: dto.showProfilePublicly,
        notifyBookings: dto.notifyBookings,
        notifyCompanions: dto.notifyCompanions,
        notifyMarketing: dto.notifyMarketing,
        ...(dto.avatarUrl !== undefined ? { avatarUrl: this.avatar(dto.avatarUrl) } : {}),
        telegramHandle: dto.telegramHandle === undefined ? undefined : (dto.telegramHandle.trim().replace(/^@/, '') || null),
        whatsappHandle: dto.whatsappHandle === undefined ? undefined : (dto.whatsappHandle.trim() || null),
      },
    });
    await this.prisma.auditLog.create({
      data: { actorId: userId, action: 'PROFILE_UPDATE', entity: 'User', entityId: userId },
    });
    return this.auth.me(userId);
  }

  private avatar(value: string) {
    const url = value.trim();
    if (!url) return null;
    if (!/^\/uploads\/[a-f0-9]{32}\.(jpe?g|png|webp)$/.test(url)) {
      throw new BadRequestException({ message: 'Upload the profile photo in the app first.', code: 'UPLOAD' });
    }
    return url;
  }

  async setMode(userId: string, dto: AccountModeDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.role === 'USER' || user.role === 'PROVIDER') {
      await this.prisma.user.update({
        where: { id: userId },
        data: { role: dto.mode === 'owner' ? 'PROVIDER' : 'USER' },
      });
    }
    return this.auth.me(userId);
  }

  async requestDeletion(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { deletionRequestedAt: new Date() },
    });
    await this.prisma.auditLog.create({
      data: { actorId: userId, action: 'DELETION_REQUESTED', entity: 'User', entityId: userId },
    });
    return {
      data: {
        ok: true,
        message: 'Deletion was requested. An administrator must complete it. Your sign-in still works until then.',
      },
    };
  }
}
