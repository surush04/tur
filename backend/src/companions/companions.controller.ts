import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CompanionStatus, JoinStatus, Prisma, Role } from '../generated/prisma/client';
import { decToString, normalizeMoney } from '../common/money';
import { CurrentUser } from '../auth/current-user';
import { Public, Roles } from '../auth/guards';
import { OptionalJwtGuard } from '../auth/optional-jwt.guard';
import { AuthUser } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

class CompanionDto {
  @IsString() @MinLength(3) @MaxLength(140) title!: string;
  @IsString() @MaxLength(120) destinationName!: string;
  @IsString() @MaxLength(40) region!: string;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @IsArray() @IsString({ each: true }) interests!: string[];
  @IsOptional() @IsString() budgetEstimate?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(8) companionsWanted!: number;
  @IsString() @MinLength(10) @MaxLength(1000) description!: string;
}

class JoinDto {
  @IsOptional() @IsString() @MaxLength(400) message?: string;
}

class ReportDto {
  @IsUUID() userId!: string;
  @IsString() @MinLength(3) @MaxLength(80) reason!: string;
  @IsOptional() @IsString() @MaxLength(500) details?: string;
}

@ApiTags('companions')
@Controller('companions')
export class CompanionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @UseGuards(OptionalJwtGuard)
  @Get()
  async list(@CurrentUser() user?: AuthUser) {
    const hidden = user ? await this.hiddenIds(user.id) : new Set<string>();
    const rows = await this.prisma.companionTrip.findMany({
      where: { status: { in: [CompanionStatus.OPEN, CompanionStatus.FULL] }, hostId: { notIn: [...hidden] } },
      include: { host: true, requests: true },
      orderBy: { startDate: 'asc' },
    });
    return { data: rows.map((row) => this.card(row, user?.id)) };
  }

  @Public()
  @UseGuards(OptionalJwtGuard)
  @Get(':id')
  async one(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    const row = await this.prisma.companionTrip.findUnique({
      where: { id },
      include: { host: true, requests: { include: { user: true } } },
    });
    if (!row) return { data: null };
    if (user && (await this.hiddenIds(user.id)).has(row.hostId) && row.hostId !== user.id) {
      return { data: null };
    }
    const isHost = user?.id === row.hostId;
    return {
      data: {
        ...this.card(row, user?.id),
        description: row.description,
        requests: isHost
          ? row.requests.map((request) => ({
              id: request.id,
              status: request.status,
              message: request.message,
              firstName: request.user.firstName,
            }))
          : [],
      },
    };
  }

  @ApiBearerAuth()
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CompanionDto) {
    if (dto.endDate < dto.startDate) {
      throw new BadRequestException({ message: 'The end date is before the start date.', code: 'DATE' });
    }
    const row = await this.prisma.companionTrip.create({
      data: {
        hostId: user.id,
        title: dto.title.trim(),
        destinationName: dto.destinationName.trim(),
        region: dto.region,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        interests: dto.interests,
        budgetEstimate: dto.budgetEstimate ? normalizeMoney(dto.budgetEstimate) : null,
        companionsWanted: dto.companionsWanted,
        description: dto.description.trim(),
      },
    });
    return { data: { id: row.id } };
  }

  @ApiBearerAuth()
  @Post(':id/join')
  async join(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: JoinDto) {
    const trip = await this.prisma.companionTrip.findUnique({ where: { id } });
    if (!trip || trip.status !== CompanionStatus.OPEN) {
      throw new BadRequestException({ message: 'This invitation is not open.', code: 'CLOSED' });
    }
    if (trip.hostId === user.id) {
      throw new BadRequestException({ message: 'You are hosting this trip.', code: 'SELF' });
    }
    const hidden = await this.hiddenIds(user.id);
    if (hidden.has(trip.hostId)) {
      throw new BadRequestException({ message: 'This invitation is not available.', code: 'BLOCKED' });
    }
    const request = await this.prisma.companionJoinRequest.create({
      data: { tripId: id, userId: user.id, message: dto.message?.trim() },
    });
    const host = await this.prisma.user.findUnique({ where: { id: trip.hostId } });
    if (host?.notifyCompanions) {
      await this.prisma.notification.create({
        data: {
          userId: host.id,
          type: 'COMPANION',
          title: 'New companion request',
          body: 'Someone asked to join your trip. Their phone number and email stay private.',
        },
      });
    }
    return { data: { id: request.id, status: request.status } };
  }

  @ApiBearerAuth()
  @Patch(':id/requests/:requestId')
  async decide(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @Body('status') status: 'ACCEPTED' | 'REJECTED',
  ) {
    const trip = await this.prisma.companionTrip.findUnique({ where: { id } });
    if (!trip || trip.hostId !== user.id) {
      throw new BadRequestException({ message: 'Only the host can respond.', code: 'FORBIDDEN' });
    }
    if (status !== 'ACCEPTED' && status !== 'REJECTED') {
      throw new BadRequestException({ message: 'Choose accept or reject.', code: 'VALIDATION' });
    }
    await this.prisma.companionJoinRequest.update({
      where: { id: requestId },
      data: { status: status === 'ACCEPTED' ? JoinStatus.ACCEPTED : JoinStatus.REJECTED },
    });
    if (status === 'ACCEPTED') {
      const accepted = await this.prisma.companionJoinRequest.count({
        where: { tripId: id, status: 'ACCEPTED' },
      });
      if (accepted >= trip.companionsWanted) {
        await this.prisma.companionTrip.update({ where: { id }, data: { status: CompanionStatus.FULL } });
      }
    }
    return { data: { ok: true } };
  }

  @ApiBearerAuth()
  @Post(':id/cancel')
  async cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const trip = await this.prisma.companionTrip.findUnique({ where: { id } });
    if (!trip || (trip.hostId !== user.id && user.role !== Role.ADMIN)) {
      throw new BadRequestException({ message: 'You cannot cancel this invitation.', code: 'FORBIDDEN' });
    }
    await this.prisma.companionTrip.update({ where: { id }, data: { status: CompanionStatus.CANCELLED } });
    return { data: { ok: true } };
  }

  @ApiBearerAuth()
  @Post('report')
  async report(@CurrentUser() user: AuthUser, @Body() dto: ReportDto) {
    await this.prisma.userReport.create({
      data: { reporterId: user.id, reportedId: dto.userId, reason: dto.reason, details: dto.details },
    });
    await this.prisma.auditLog.create({
      data: { actorId: user.id, action: 'USER_REPORT', entity: 'User', entityId: dto.userId },
    });
    return { data: { ok: true, message: 'Report sent to moderators.' } };
  }

  @ApiBearerAuth()
  @Post('block')
  async block(@CurrentUser() user: AuthUser, @Body('userId') userId: string) {
    if (!userId || userId === user.id) {
      throw new BadRequestException({ message: 'Choose another person to block.', code: 'VALIDATION' });
    }
    await this.prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId: user.id, blockedId: userId } },
      update: {},
      create: { blockerId: user.id, blockedId: userId },
    });
    return { data: { ok: true } };
  }

  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Get('manage/all')
  async manage() {
    const rows = await this.prisma.companionTrip.findMany({
      include: { host: true, requests: true },
      orderBy: { createdAt: 'desc' },
    });
    return {
      data: rows.map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        hostEmail: row.host.email,
        requests: row.requests.length,
      })),
    };
  }

  private card(
    row: {
      id: string;
      title: string;
      destinationName: string;
      region: string;
      startDate: Date;
      endDate: Date;
      interests: string[];
      budgetEstimate: Prisma.Decimal | null;
      companionsWanted: number;
      status: CompanionStatus;
      host: { id: string; firstName: string; avatarUrl: string | null; showProfilePublicly: boolean };
      requests: { status: JoinStatus }[];
    },
    viewerId?: string,
  ) {
    const accepted = row.requests.filter((request) => request.status === 'ACCEPTED').length;
    return {
      id: row.id,
      title: row.title,
      destinationName: row.destinationName,
      region: row.region,
      startDate: row.startDate.toISOString().slice(0, 10),
      endDate: row.endDate.toISOString().slice(0, 10),
      interests: row.interests,
      budgetEstimate: decToString(row.budgetEstimate),
      companionsWanted: row.companionsWanted,
      accepted,
      status: row.status,
      hostId: row.host.id,
      isHost: viewerId === row.host.id,
      host: row.host.showProfilePublicly
        ? { displayName: row.host.firstName, avatarUrl: row.host.avatarUrl }
        : { displayName: 'Traveler', avatarUrl: null },
      safetyNote: 'Do not put your phone number, documents, or home address in a public invitation.',
    };
  }

  private async hiddenIds(userId: string) {
    const blocks = await this.prisma.userBlock.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    });
    const ids = new Set<string>();
    for (const block of blocks) {
      ids.add(block.blockerId === userId ? block.blockedId : block.blockerId);
    }
    return ids;
  }
}
