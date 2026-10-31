import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { randomBytes } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { decToString, mulMoney, normalizeMoney } from '../common/money';
import {
  ContactRequestStatus,
  GroupJoinMode,
  GroupMemberRole,
  GroupVisibility,
  InquiryStatus,
  PollStatus,
  Prisma,
  ProposalStatus,
  Role,
  VideoModeration,
} from '../generated/prisma/client';
import { CurrentUser } from '../auth/current-user';
import { Public, Roles } from '../auth/guards';
import { AuthUser } from '../auth/jwt.strategy';
import { OptionalJwtGuard } from '../auth/optional-jwt.guard';
import { PrismaService } from '../prisma/prisma.service';
import {
  canReadGroupChat,
  contactRateLimited,
  initialVideoStatus,
  inquiryReservesSeats,
  isOperatorRole,
  visibleToOperators,
} from './social-rules';

const MONEY = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;
const UPLOAD_VIDEO = /^\/uploads\/[a-f0-9]{32}\.(mp4|webm|mov)$/;
const UPLOAD_IMAGE = /^\/uploads\/[a-f0-9]{32}\.(jpe?g|png|webp)$/;

class GroupDto {
  @IsString() @MinLength(3) @MaxLength(80) name!: string;
  @IsOptional() @IsString() @MaxLength(300) coverImageUrl?: string;
  @IsString() @MinLength(2) @MaxLength(80) destinationName!: string;
  @IsString() @MaxLength(40) region!: string;
  @IsString() @MinLength(10) @MaxLength(2000) description!: string;
  @IsOptional() @IsDateString() departureDate?: string;
  @IsOptional() @IsString() @MaxLength(8) departureTime?: string;
  @IsOptional() @IsBoolean() flexibleDates?: boolean;
  @IsOptional() @Matches(MONEY) budgetPerPerson?: string;
  @Type(() => Number) @IsInt() @Min(2) @Max(40) desiredSize!: number;
  @IsOptional() @IsString() @MaxLength(80) travelStyle?: string;
  @IsIn(['PUBLIC', 'PRIVATE']) visibility!: 'PUBLIC' | 'PRIVATE';
  @IsIn(['OPEN', 'REQUEST']) joinMode!: 'OPEN' | 'REQUEST';
  @IsOptional() @IsString() @MaxLength(1000) rules?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) interests?: string[];
}

class JoinDto {
  @IsOptional() @IsString() @MaxLength(400) message?: string;
}

class MessageDto {
  @IsString() @MinLength(1) @MaxLength(2000) body!: string;
}

class ProposalDto {
  @IsOptional() @IsUUID() tourId?: string;
  @IsString() @MinLength(2) @MaxLength(120) title!: string;
  @IsString() @MinLength(2) @MaxLength(80) operatorName!: string;
  @IsString() @MinLength(2) @MaxLength(80) destinationName!: string;
  @Matches(MONEY) pricePerPerson!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(60) durationDays!: number;
  @IsOptional() @IsDateString() departureDate?: string;
  @IsString() @MinLength(2) @MaxLength(1000) included!: string;
  @IsString() @MinLength(2) @MaxLength(1000) excluded!: string;
  @IsOptional() @IsBoolean() custom?: boolean;
}

class PollDto {
  @IsString() @MinLength(3) @MaxLength(160) question!: string;
  @IsArray() @IsString({ each: true }) options!: string[];
}

class VoteOptionDto {
  @IsUUID() optionId!: string;
}

class ContactDto {
  @IsString() @MinLength(10) @MaxLength(1000) message!: string;
  @IsOptional() @IsUUID() tourId?: string;
}

class InquiryDto {
  @IsOptional() @IsUUID() contactRequestId?: string;
  @IsOptional() @IsUUID() tourId?: string;
  @IsOptional() @IsUUID() proposalId?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(40) travelers!: number;
  @IsOptional() @IsDateString() preferredDate?: string;
  @IsOptional() @Matches(MONEY) proposedPrice?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

class InquiryStatusDto {
  @IsIn(['CONTACTED', 'CONFIRMED', 'CANCELLED', 'COMPLETED']) status!: InquiryStatus;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

class VideoDto {
  @IsString() @MinLength(3) @MaxLength(280) caption!: string;
  @IsString() @MinLength(2) @MaxLength(80) destinationName!: string;
  @IsString() @MaxLength(40) region!: string;
  @IsString() @MinLength(8) @MaxLength(300) posterUrl!: string;
  @IsString() @MinLength(8) @MaxLength(300) videoUrl!: string;
  @IsOptional() @IsUUID() tourId?: string;
  @IsOptional() @IsUUID() groupId?: string;
}

class CommentDto {
  @IsString() @MinLength(1) @MaxLength(500) body!: string;
}

class ReportDto {
  @IsString() @MinLength(3) @MaxLength(40) targetType!: string;
  @IsUUID() targetId!: string;
  @IsString() @MinLength(3) @MaxLength(200) reason!: string;
}

class BlockDto {
  @IsUUID() userId!: string;
}

class RequestDecisionDto {
  @IsIn(['ACCEPTED', 'REJECTED']) status!: 'ACCEPTED' | 'REJECTED';
}

class ContactDecisionDto {
  @IsIn(['ACCEPTED', 'DECLINED']) status!: 'ACCEPTED' | 'DECLINED';
}

class DirectConversationDto {
  @IsUUID() tourId!: string;
  @IsString() @MinLength(1) @MaxLength(2000) body!: string;
}

class ModerationDto {
  @IsIn(['PENDING', 'PUBLISHED', 'HIDDEN']) status!: 'PENDING' | 'PUBLISHED' | 'HIDDEN';
}

class ReportStatusDto {
  @IsIn(['OPEN', 'REVIEWED', 'DISMISSED']) status!: string;
}

@ApiTags('social')
@Controller('social')
export class SocialController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('search')
  async search(@Query('q') q = '') {
    const term = q.trim().slice(0, 80);
    if (term.length < 2) return { data: { groups: [], videos: [] } };
    const [groups, videos] = await Promise.all([
      this.prisma.travelGroup.findMany({
        where: {
          visibility: GroupVisibility.PUBLIC,
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { destinationName: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } },
          ],
        },
        include: { _count: { select: { members: true } } },
        take: 12,
      }),
      this.prisma.travelVideo.findMany({
        where: {
          status: VideoModeration.PUBLISHED,
          OR: [
            { caption: { contains: term, mode: 'insensitive' } },
            { destinationName: { contains: term, mode: 'insensitive' } },
          ],
        },
        take: 8,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { data: { groups: groups.map((row) => this.groupCard(row)), videos: videos.map((row) => this.videoCard(row)) } };
  }

  @Public()
  @UseGuards(OptionalJwtGuard)
  @Get('videos')
  async videos(@CurrentUser() user?: AuthUser) {
    const rows = await this.prisma.travelVideo.findMany({
      where: { status: VideoModeration.PUBLISHED },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: this.videoInclude(user?.id),
    });
    return { data: rows.map((row) => this.videoCard(row, user?.id)) };
  }

  @Get('videos/saved')
  async saved(@CurrentUser() user: AuthUser) {
    const rows = await this.prisma.savedVideo.findMany({
      where: { userId: user.id, video: { status: VideoModeration.PUBLISHED } },
      include: { video: { include: this.videoInclude(user.id) } },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
    return { data: rows.map((row) => this.videoCard(row.video, user.id)) };
  }

  @Get('videos/mine')
  async myVideos(@CurrentUser() user: AuthUser) {
    const rows = await this.prisma.travelVideo.findMany({
      where: { creatorId: user.id },
      orderBy: { createdAt: 'desc' },
      include: this.videoInclude(user.id),
    });
    return { data: rows.map((row) => this.videoCard(row, user.id)) };
  }

  @Public()
  @UseGuards(OptionalJwtGuard)
  @Get('videos/:id')
  async video(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    const row = await this.prisma.travelVideo.findFirst({
      where: { id, OR: [{ status: VideoModeration.PUBLISHED }, { creatorId: user?.id ?? 'none' }] },
      include: this.videoInclude(user?.id),
    });
    if (!row) throw new NotFoundException({ message: 'Video was not found.', code: 'NOT_FOUND' });
    return { data: this.videoCard(row, user?.id) };
  }

  @Post('media')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 25 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        const ok = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'].includes(file.mimetype);
        callback(ok ? null : new BadRequestException({ message: 'Upload a JPEG, PNG, WebP, MP4, or WebM file.', code: 'UPLOAD' }), ok);
      },
      storage: diskStorage({
        destination: (_req, _file, callback) => {
          const dir = join(process.cwd(), 'uploads');
          mkdirSync(dir, { recursive: true });
          callback(null, dir);
        },
        filename: (_req, file, callback) => {
          const map: Record<string, string> = {
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'image/webp': '.webp',
            'video/mp4': '.mp4',
            'video/webm': '.webm',
            'video/quicktime': '.mov',
          };
          const extension = map[file.mimetype] ?? extname(file.originalname).toLowerCase();
          callback(null, `${randomBytes(16).toString('hex')}${extension}`);
        },
      }),
    }),
  )
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException({ message: 'Choose a file. Nothing was stored.', code: 'UPLOAD' });
    const kind = file.mimetype.startsWith('video/') ? 'video' : 'image';
    return { data: { url: `/uploads/${file.filename}`, kind } };
  }

  @Post('videos')
  async publishVideo(@CurrentUser() user: AuthUser, @Body() dto: VideoDto) {
    this.assertStored(dto.videoUrl, UPLOAD_VIDEO, 'Upload the video before publishing it.');
    this.assertStored(dto.posterUrl, UPLOAD_IMAGE, 'Upload a poster image before publishing.');
    if (dto.tourId) {
      const tour = await this.prisma.tour.findFirst({ where: { id: dto.tourId, published: true } });
      if (!tour) throw new BadRequestException({ message: 'That tour is not published.', code: 'TOUR' });
    }
    if (dto.groupId) {
      const member = await this.prisma.groupMembership.findUnique({ where: { groupId_userId: { groupId: dto.groupId, userId: user.id } } });
      if (!member) throw new ForbiddenException({ message: 'Only a member can link this group.', code: 'GROUP' });
    }
    const status = initialVideoStatus(user.role);
    const row = await this.prisma.travelVideo.create({
      data: {
        creatorId: user.id,
        caption: dto.caption.trim(),
        destinationName: dto.destinationName.trim(),
        region: dto.region.trim(),
        posterUrl: dto.posterUrl,
        videoUrl: dto.videoUrl,
        tourId: dto.tourId,
        groupId: dto.groupId,
        status: status === 'PUBLISHED' ? VideoModeration.PUBLISHED : VideoModeration.PENDING,
      },
      include: this.videoInclude(user.id),
    });
    return { data: this.videoCard(row, user.id) };
  }

  @Post('videos/:id/like')
  async like(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.publishedVideo(id);
    const existing = await this.prisma.videoLike.findUnique({ where: { videoId_userId: { videoId: id, userId: user.id } } });
    if (existing) await this.prisma.videoLike.delete({ where: { id: existing.id } });
    else await this.prisma.videoLike.create({ data: { videoId: id, userId: user.id } });
    const count = await this.prisma.videoLike.count({ where: { videoId: id } });
    return { data: { liked: !existing, count } };
  }

  @Post('videos/:id/save')
  async saveVideo(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.publishedVideo(id);
    const existing = await this.prisma.savedVideo.findUnique({ where: { videoId_userId: { videoId: id, userId: user.id } } });
    if (existing) await this.prisma.savedVideo.delete({ where: { id: existing.id } });
    else await this.prisma.savedVideo.create({ data: { videoId: id, userId: user.id } });
    return { data: { saved: !existing } };
  }

  @Public()
  @Get('videos/:id/comments')
  async comments(@Param('id') id: string) {
    await this.publishedVideo(id);
    const rows = await this.prisma.videoComment.findMany({
      where: { videoId: id },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });
    return {
      data: rows.map((row) => ({
        id: row.id,
        body: row.body,
        createdAt: row.createdAt.toISOString(),
        author: row.user.showProfilePublicly ? row.user.firstName : 'Traveler',
      })),
    };
  }

  @Post('videos/:id/comments')
  async comment(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CommentDto) {
    await this.publishedVideo(id);
    const row = await this.prisma.videoComment.create({ data: { videoId: id, userId: user.id, body: dto.body.trim() } });
    return { data: { id: row.id } };
  }

  @Public()
  @Get('groups')
  async groups(
    @Query('q') q?: string,
    @Query('destination') destination?: string,
    @Query('region') region?: string,
    @Query('date') date?: string,
    @Query('budget') budget?: string,
    @Query('size') size?: string,
  ) {
    const rows = await this.prisma.travelGroup.findMany({
      where: this.groupFilter({ q, destination, region, date, budget, size, visibility: GroupVisibility.PUBLIC }),
      include: { _count: { select: { members: true } } },
      orderBy: { departureDate: 'asc' },
      take: 40,
    });
    return { data: rows.map((row) => this.groupCard(row)) };
  }

  @Get('groups/mine')
  async mine(@CurrentUser() user: AuthUser) {
    const rows = await this.prisma.travelGroup.findMany({
      where: { members: { some: { userId: user.id } } },
      include: { _count: { select: { members: true } }, members: { where: { userId: user.id } } },
      orderBy: { updatedAt: 'desc' },
    });
    return {
      data: rows.map((row) => ({
        ...this.groupCard(row),
        role: row.members[0]?.role ?? 'MEMBER',
      })),
    };
  }

  @Roles(Role.PROVIDER, Role.GUIDE, Role.ADMIN)
  @Get('groups/operator')
  async operatorGroups(
    @Query('q') q?: string,
    @Query('destination') destination?: string,
    @Query('region') region?: string,
    @Query('date') date?: string,
    @Query('budget') budget?: string,
    @Query('size') size?: string,
  ) {
    const rows = await this.prisma.travelGroup.findMany({
      where: this.groupFilter({ q, destination, region, date, budget, size, visibility: GroupVisibility.PUBLIC }),
      include: { _count: { select: { members: true } } },
      orderBy: { departureDate: 'asc' },
      take: 40,
    });
    return { data: rows.filter((row) => visibleToOperators(row.visibility)).map((row) => this.groupCard(row)) };
  }

  @Post('groups')
  async createGroup(@CurrentUser() user: AuthUser, @Body() dto: GroupDto) {
    if (dto.coverImageUrl) this.assertStored(dto.coverImageUrl, UPLOAD_IMAGE, 'Upload a cover image, or leave it empty.');
    const group = await this.prisma.travelGroup.create({
      data: {
        organizerId: user.id,
        name: dto.name.trim(),
        coverImageUrl: dto.coverImageUrl,
        destinationName: dto.destinationName.trim(),
        region: dto.region.trim(),
        description: dto.description.trim(),
        departureDate: asDate(dto.departureDate),
        departureTime: dto.departureTime?.trim(),
        flexibleDates: dto.flexibleDates ?? false,
        budgetPerPerson: dto.budgetPerPerson ? normalizeMoney(dto.budgetPerPerson) : null,
        desiredSize: dto.desiredSize,
        travelStyle: dto.travelStyle?.trim(),
        visibility: dto.visibility,
        joinMode: dto.joinMode,
        rules: dto.rules?.trim(),
        interests: (dto.interests ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 8),
        members: { create: { userId: user.id, role: GroupMemberRole.ORGANIZER } },
        messages: { create: { body: 'Group created. A vote is not a booking.', system: true } },
      },
    });
    return { data: { id: group.id } };
  }

  @Public()
  @UseGuards(OptionalJwtGuard)
  @Get('groups/:id')
  async group(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    const row = await this.loadGroup(id);
    const membership = user ? row.members.find((member) => member.userId === user.id) : undefined;
    if (row.visibility === GroupVisibility.PRIVATE && !membership) {
      throw new NotFoundException({ message: 'Group was not found.', code: 'NOT_FOUND' });
    }
    const isMember = Boolean(membership);
    const isOrganizer = membership?.role === GroupMemberRole.ORGANIZER;
    const voteRows = isMember || isOperatorRole(user?.role ?? '') ? row.proposals.flatMap((proposal) => proposal.votes) : [];
    const myVote = voteRows.find((vote) => vote.userId === user?.id)?.proposalId ?? null;
    return {
      data: {
        ...this.groupCard(row),
        description: row.description,
        rules: row.rules,
        interests: row.interests,
        flexibleDates: row.flexibleDates,
        travelStyle: row.travelStyle,
        departureTime: row.departureTime,
        joinMode: row.joinMode,
        isMember,
        isOrganizer,
        isOperator: isOperatorRole(user?.role ?? ''),
        myVote,
        seatsReserved: false,
        organizer: {
          firstName: row.organizer.showProfilePublicly || isMember ? row.organizer.firstName : 'Organizer',
        },
        members: isMember
          ? row.members.map((member) => ({
              userId: member.userId,
              firstName: member.user.firstName,
              role: member.role,
            }))
          : [],
        joinRequests: isOrganizer
          ? row.joinRequests
              .filter((request) => request.status === 'PENDING')
              .map((request) => ({ id: request.id, firstName: request.user.firstName, message: request.message, status: request.status }))
          : [],
        proposals: row.proposals.map((proposal) => ({
          id: proposal.id,
          tourId: proposal.tourId,
          tourSlug: proposal.tour?.slug ?? null,
          title: proposal.title,
          operatorName: proposal.operatorName,
          destinationName: proposal.destinationName,
          pricePerPerson: decToString(proposal.pricePerPerson),
          durationDays: proposal.durationDays,
          departureDate: isoDate(proposal.departureDate),
          included: proposal.included,
          excluded: proposal.excluded,
          custom: proposal.custom,
          status: proposal.status,
          votes: proposal.votes.length,
        })),
        polls: isMember
          ? row.polls.map((poll) => ({
              id: poll.id,
              question: poll.question,
              status: poll.status,
              closedOptionId: poll.closedOptionId,
              options: poll.options.map((option) => ({
                id: option.id,
                label: option.label,
                votes: option.votes.length,
                mine: option.votes.some((vote) => vote.userId === user?.id),
              })),
            }))
          : [],
        summary: this.summary(row),
        contactRequests: isOrganizer
          ? row.contactRequests.map((request) => ({
              id: request.id,
              status: request.status,
              message: request.message,
              operatorFirstName: request.operator.firstName,
              createdAt: request.createdAt.toISOString(),
            }))
          : [],
      },
    };
  }

  @Post('groups/:id/join')
  async join(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: JoinDto) {
    const group = await this.loadGroup(id);
    if (group.members.some((member) => member.userId === user.id)) {
      return { data: { status: 'MEMBER' } };
    }
    const name = await this.firstName(user.id);
    if (group.joinMode === GroupJoinMode.OPEN) {
      await this.prisma.groupMembership.create({ data: { groupId: id, userId: user.id, role: GroupMemberRole.MEMBER } });
      await this.system(id, `${name} joined the group.`);
      await this.notify(group.organizerId, 'New group member', `${name} joined ${group.name}.`, 'GROUP');
      return { data: { status: 'JOINED' } };
    }
    await this.prisma.groupJoinRequest.upsert({
      where: { groupId_userId: { groupId: id, userId: user.id } },
      update: { status: 'PENDING', message: dto.message?.trim() },
      create: { groupId: id, userId: user.id, message: dto.message?.trim() },
    });
    await this.notify(group.organizerId, 'Join request', `${name} asked to join ${group.name}.`, 'GROUP');
    return { data: { status: 'PENDING' } };
  }

  @Post('groups/:id/leave')
  async leave(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const membership = await this.prisma.groupMembership.findUnique({ where: { groupId_userId: { groupId: id, userId: user.id } } });
    if (!membership) return { data: { ok: true } };
    if (membership.role === GroupMemberRole.ORGANIZER) {
      throw new BadRequestException({ message: 'The organizer cannot leave this group.', code: 'ORGANIZER' });
    }
    await this.prisma.groupMembership.delete({ where: { id: membership.id } });
    await this.system(id, 'A member left the group.');
    return { data: { ok: true } };
  }

  @Delete('groups/:id')
  async removeGroup(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const group = await this.prisma.travelGroup.findUnique({ where: { id } });
    if (!group || group.organizerId !== user.id) throw new ForbiddenException({ message: 'Only the organizer can delete this group.', code: 'GROUP' });
    await this.prisma.travelGroup.delete({ where: { id } });
    return { data: { ok: true } };
  }

  @Patch('groups/:id/requests/:requestId')
  async decideRequest(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @Body() dto: RequestDecisionDto,
  ) {
    const group = await this.organizerGroup(id, user.id);
    const request = await this.prisma.groupJoinRequest.findFirst({ where: { id: requestId, groupId: id }, include: { user: true } });
    if (!request) throw new NotFoundException({ message: 'Request was not found.', code: 'NOT_FOUND' });
    await this.prisma.groupJoinRequest.update({ where: { id: requestId }, data: { status: dto.status } });
    if (dto.status === 'ACCEPTED') {
      await this.prisma.groupMembership.upsert({
        where: { groupId_userId: { groupId: id, userId: request.userId } },
        update: {},
        create: { groupId: id, userId: request.userId, role: GroupMemberRole.MEMBER },
      });
      await this.system(id, `${request.user.firstName} joined the group.`);
      await this.notify(request.userId, 'Request accepted', `You can now talk in ${group.name}.`, 'GROUP');
    }
    return { data: { status: dto.status } };
  }

  @Get('groups/:id/messages')
  async messages(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('before') before?: string) {
    await this.requireMember(id, user.id);
    const rows = await this.prisma.groupMessage.findMany({
      where: { groupId: id, createdAt: before ? { lt: new Date(before) } : undefined },
      include: { sender: true },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
    const messages = rows.reverse().map((row) => ({
      id: row.id,
      body: row.body,
      system: row.system,
      createdAt: row.createdAt.toISOString(),
      sender: row.sender ? { firstName: row.sender.firstName, mine: row.senderId === user.id } : null,
    }));
    return { data: { messages, nextBefore: rows[0]?.createdAt.toISOString() ?? null } };
  }

  @Post('groups/:id/messages')
  async postMessage(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: MessageDto) {
    const group = await this.requireMember(id, user.id);
    if (await this.blocked(user.id, group.organizerId)) {
      throw new ForbiddenException({ message: 'You cannot send messages in this group.', code: 'BLOCKED' });
    }
    const row = await this.prisma.groupMessage.create({ data: { groupId: id, senderId: user.id, body: dto.body.trim() } });
    const name = await this.firstName(user.id);
    const others = group.members.filter((member) => member.userId !== user.id);
    await Promise.all(others.map((member) => this.notify(member.userId, group.name, `${name}: ${dto.body.trim().slice(0, 120)}`, 'GROUP')));
    return { data: { id: row.id, createdAt: row.createdAt.toISOString() } };
  }

  @Post('groups/:id/proposals')
  async propose(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ProposalDto) {
    const group = await this.loadGroup(id);
    const member = group.members.some((item) => item.userId === user.id);
    const operator = isOperatorRole(user.role) && group.visibility === GroupVisibility.PUBLIC;
    if (!member && !operator) throw new ForbiddenException({ message: 'Join the group or use an operator account.', code: 'GROUP' });
    let tourId = dto.tourId;
    if (tourId) {
      const tour = await this.prisma.tour.findFirst({ where: { id: tourId, published: true }, include: { guide: true } });
      if (!tour) throw new BadRequestException({ message: 'That tour is not published.', code: 'TOUR' });
    }
    const row = await this.prisma.tourProposal.create({
      data: {
        groupId: id,
        tourId,
        proposerId: user.id,
        operatorName: dto.operatorName.trim(),
        title: dto.title.trim(),
        destinationName: dto.destinationName.trim(),
        pricePerPerson: normalizeMoney(dto.pricePerPerson),
        durationDays: dto.durationDays,
        departureDate: asDate(dto.departureDate),
        included: dto.included.trim(),
        excluded: dto.excluded.trim(),
        custom: dto.custom ?? !tourId,
      },
    });
    await this.system(id, `A tour was proposed: ${row.title}. Voting does not reserve seats.`);
    if (group.organizerId !== user.id) {
      await this.notify(group.organizerId, 'Tour proposal', `${row.title} was proposed in ${group.name}.`, 'GROUP');
    }
    return { data: { id: row.id } };
  }

  @Post('groups/:id/proposals/:proposalId/vote')
  async vote(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('proposalId') proposalId: string) {
    await this.requireMember(id, user.id);
    const proposal = await this.prisma.tourProposal.findFirst({ where: { id: proposalId, groupId: id, status: { not: ProposalStatus.CLOSED } } });
    if (!proposal) throw new NotFoundException({ message: 'Proposal was not found.', code: 'NOT_FOUND' });
    await this.prisma.$transaction(async (tx) => {
      await tx.tourVote.deleteMany({ where: { groupId: id, userId: user.id } });
      await tx.tourVote.create({ data: { groupId: id, proposalId, userId: user.id } });
    });
    const group = await this.prisma.travelGroup.findUnique({ where: { id } });
    if (group && group.organizerId !== user.id) {
      const name = await this.firstName(user.id);
      await this.notify(group.organizerId, 'New vote', `${name} voted in ${group.name}. A vote is not a booking.`, 'GROUP');
    }
    return { data: { proposalId } };
  }

  @Post('groups/:id/proposals/:proposalId/select')
  async selectProposal(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('proposalId') proposalId: string) {
    const group = await this.organizerGroup(id, user.id);
    const proposal = await this.prisma.tourProposal.findFirst({ where: { id: proposalId, groupId: id } });
    if (!proposal) throw new NotFoundException({ message: 'Proposal was not found.', code: 'NOT_FOUND' });
    await this.prisma.$transaction([
      this.prisma.tourProposal.updateMany({ where: { groupId: id, status: ProposalStatus.SELECTED }, data: { status: ProposalStatus.OPEN } }),
      this.prisma.tourProposal.update({ where: { id: proposalId }, data: { status: ProposalStatus.SELECTED } }),
      this.prisma.travelGroup.update({ where: { id }, data: { selectedProposalId: proposalId, status: 'DECIDED' } }),
    ]);
    await this.system(id, `The organizer selected “${proposal.title}”. This is not a confirmed reservation.`);
    return { data: { selectedProposalId: proposalId, group: group.name, seatsReserved: false } };
  }

  @Post('groups/:id/polls')
  async createPoll(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: PollDto) {
    await this.requireMember(id, user.id);
    const labels = dto.options.map((item) => item.trim()).filter(Boolean).slice(0, 6);
    if (labels.length < 2) throw new BadRequestException({ message: 'Add at least two date options.', code: 'POLL' });
    const poll = await this.prisma.datePoll.create({
      data: {
        groupId: id,
        question: dto.question.trim(),
        createdById: user.id,
        options: { create: labels.map((label) => ({ label, date: asDate(label) })) },
      },
    });
    await this.system(id, `Date poll: ${poll.question}`);
    return { data: { id: poll.id } };
  }

  @Post('groups/:id/polls/:pollId/vote')
  async votePoll(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('pollId') pollId: string, @Body() dto: VoteOptionDto) {
    await this.requireMember(id, user.id);
    const poll = await this.prisma.datePoll.findFirst({ where: { id: pollId, groupId: id }, include: { options: true } });
    if (!poll || poll.status !== PollStatus.OPEN) throw new BadRequestException({ message: 'This poll is closed.', code: 'POLL' });
    if (!poll.options.some((option) => option.id === dto.optionId)) {
      throw new BadRequestException({ message: 'That option is not in this poll.', code: 'POLL' });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.datePollVote.deleteMany({ where: { pollId, userId: user.id } });
      await tx.datePollVote.create({ data: { pollId, optionId: dto.optionId, userId: user.id } });
    });
    return { data: { optionId: dto.optionId } };
  }

  @Post('groups/:id/polls/:pollId/close')
  async closePoll(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('pollId') pollId: string, @Body() dto: VoteOptionDto) {
    await this.organizerGroup(id, user.id);
    const option = await this.prisma.datePollOption.findFirst({ where: { id: dto.optionId, pollId }, include: { poll: true } });
    if (!option || option.poll.groupId !== id) throw new NotFoundException({ message: 'Poll option was not found.', code: 'NOT_FOUND' });
    await this.prisma.datePoll.update({ where: { id: pollId }, data: { status: PollStatus.CLOSED, closedOptionId: option.id } });
    const date = option.date ?? asDate(option.label);
    if (date) await this.prisma.travelGroup.update({ where: { id }, data: { departureDate: date } });
    await this.system(id, `The organizer closed the date poll on “${option.label}”. Seats are not reserved.`);
    return { data: { closedOptionId: option.id, seatsReserved: false } };
  }

  @Roles(Role.PROVIDER, Role.GUIDE, Role.ADMIN)
  @Post('groups/:id/contact')
  async contact(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ContactDto) {
    const group = await this.prisma.travelGroup.findUnique({ where: { id } });
    if (!group || !visibleToOperators(group.visibility)) {
      throw new NotFoundException({ message: 'Group was not found.', code: 'NOT_FOUND' });
    }
    if (group.organizerId === user.id) throw new BadRequestException({ message: 'You already organize this group.', code: 'CONTACT' });
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await this.prisma.contactRequest.count({
      where: { operatorId: user.id, createdAt: { gte: since }, status: { in: [ContactRequestStatus.PENDING, ContactRequestStatus.ACCEPTED] } },
    });
    if (contactRateLimited(recent)) {
      throw new HttpException({ message: 'You have sent enough contact requests today.', code: 'RATE' }, HttpStatus.TOO_MANY_REQUESTS);
    }
    const pending = await this.prisma.contactRequest.findFirst({
      where: { groupId: id, operatorId: user.id, status: ContactRequestStatus.PENDING },
    });
    if (pending) throw new BadRequestException({ message: 'You already have a pending request for this group.', code: 'CONTACT' });
    const row = await this.prisma.contactRequest.create({
      data: { groupId: id, operatorId: user.id, tourId: dto.tourId, message: dto.message.trim() },
    });
    await this.notify(group.organizerId, 'Operator contact', `A tour operator wants to talk about ${group.name}.`, 'CONTACT');
    return { data: { id: row.id, status: row.status } };
  }

  @Get('contact-requests')
  async myContacts(@CurrentUser() user: AuthUser) {
    await this.expireContacts(user.id);
    const rows = await this.prisma.contactRequest.findMany({
      where: { OR: [{ operatorId: user.id }, { group: { organizerId: user.id } }] },
      include: { group: true, operator: true },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
    return {
      data: rows.map((row) => ({
        id: row.id,
        status: row.status,
        message: row.message,
        groupId: row.groupId,
        groupName: row.group.name,
        operatorFirstName: row.operator.firstName,
        incoming: row.group.organizerId === user.id,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  @Patch('contact-requests/:id')
  async decideContact(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ContactDecisionDto) {
    const request = await this.prisma.contactRequest.findUnique({ where: { id }, include: { group: true } });
    if (!request || request.group.organizerId !== user.id) {
      throw new ForbiddenException({ message: 'Only the organizer can answer this request.', code: 'CONTACT' });
    }
    if (request.status !== ContactRequestStatus.PENDING) {
      throw new BadRequestException({ message: 'This request is no longer pending.', code: 'CONTACT' });
    }
    if (dto.status === 'DECLINED') {
      await this.prisma.contactRequest.update({ where: { id }, data: { status: ContactRequestStatus.DECLINED } });
      await this.notify(request.operatorId, 'Contact declined', `The organizer declined contact for ${request.group.name}.`, 'CONTACT');
      return { data: { status: 'DECLINED' } };
    }
    const conversation = await this.prisma.$transaction(async (tx) => {
      await tx.contactRequest.update({ where: { id }, data: { status: ContactRequestStatus.ACCEPTED } });
      return tx.conversation.create({
        data: {
          contactRequestId: id,
          groupId: request.groupId,
          tourId: request.tourId,
          members: { create: [{ userId: request.group.organizerId }, { userId: request.operatorId }] },
          messages: { create: { senderId: request.operatorId, body: request.message } },
        },
      });
    });
    await this.notify(request.operatorId, 'Contact accepted', `You can message the organizer of ${request.group.name}.`, 'CONTACT');
    return { data: { status: 'ACCEPTED', conversationId: conversation.id } };
  }

  @Get('conversations')
  async conversations(@CurrentUser() user: AuthUser) {
    const rows = await this.prisma.conversation.findMany({
      where: { members: { some: { userId: user.id } } },
      include: { group: true, messages: { orderBy: { createdAt: 'desc' }, take: 1 }, members: { include: { user: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return {
      data: rows.map((row) => ({
        id: row.id,
        groupId: row.groupId,
        groupName: row.group?.name ?? null,
        tourId: row.tourId,
        preview: row.messages[0]?.body ?? '',
        with: row.members.filter((member) => member.userId !== user.id).map((member) => member.user.firstName),
      })),
    };
  }

  @Post('conversations')
  async startConversation(@CurrentUser() user: AuthUser, @Body() dto: DirectConversationDto) {
    const tour = await this.prisma.tour.findFirst({ where: { id: dto.tourId, published: true }, include: { guide: true } });
    const operatorId = tour?.guide?.userId;
    if (!tour || !operatorId) {
      throw new BadRequestException({ message: 'This tour has no operator account to contact.', code: 'CONTACT' });
    }
    if (operatorId === user.id) throw new BadRequestException({ message: 'You cannot contact yourself.', code: 'CONTACT' });
    if (await this.blocked(user.id, operatorId)) throw new ForbiddenException({ message: 'This conversation is not available.', code: 'BLOCKED' });
    const existing = await this.prisma.conversation.findFirst({
      where: { tourId: tour.id, members: { every: { userId: { in: [user.id, operatorId] } } }, AND: [{ members: { some: { userId: user.id } } }, { members: { some: { userId: operatorId } } }] },
    });
    const conversation =
      existing ??
      (await this.prisma.conversation.create({
        data: { tourId: tour.id, members: { create: [{ userId: user.id }, { userId: operatorId }] } },
      }));
    await this.prisma.conversationMessage.create({ data: { conversationId: conversation.id, senderId: user.id, body: dto.body.trim() } });
    const name = await this.firstName(user.id);
    await this.notify(operatorId, tour.title, `${name} sent a message about this tour.`, 'CONTACT');
    return { data: { id: conversation.id } };
  }

  @Get('conversations/:id')
  async conversation(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const row = await this.memberConversation(id, user.id);
    return {
      data: {
        id: row.id,
        groupId: row.groupId,
        groupName: row.group?.name ?? null,
        tourId: row.tourId,
        messages: row.messages.map((message) => ({
          id: message.id,
          body: message.body,
          createdAt: message.createdAt.toISOString(),
          mine: message.senderId === user.id,
          sender: message.sender.firstName,
        })),
      },
    };
  }

  @Post('conversations/:id/messages')
  async conversationMessage(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: MessageDto) {
    const row = await this.memberConversation(id, user.id);
    const other = row.members.find((member) => member.userId !== user.id);
    if (other && (await this.blocked(user.id, other.userId))) {
      throw new ForbiddenException({ message: 'This conversation is not available.', code: 'BLOCKED' });
    }
    const message = await this.prisma.conversationMessage.create({
      data: { conversationId: id, senderId: user.id, body: dto.body.trim() },
    });
    if (other) await this.notify(other.userId, 'New message', dto.body.trim().slice(0, 140), 'CONTACT');
    return { data: { id: message.id } };
  }

  @Post('groups/:id/inquiries')
  async inquire(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: InquiryDto) {
    const group = await this.organizerGroup(id, user.id);
    const operatorId = await this.resolveOperator(group.id, dto);
    const history = [{ status: 'PENDING', at: new Date().toISOString(), note: 'Inquiry submitted. Seats are not reserved.' }];
    const row = await this.prisma.groupInquiry.create({
      data: {
        groupId: id,
        organizerId: user.id,
        operatorId,
        tourId: dto.tourId,
        proposalId: dto.proposalId,
        travelers: dto.travelers,
        preferredDate: asDate(dto.preferredDate),
        proposedPrice: dto.proposedPrice ? normalizeMoney(dto.proposedPrice) : null,
        notes: dto.notes?.trim(),
        status: InquiryStatus.PENDING,
        statusHistory: history,
      },
    });
    await this.notify(operatorId, 'Booking inquiry', `${group.name} asked about a trip. No seats are held.`, 'INQUIRY');
    return { data: { id: row.id, status: row.status, seatsReserved: inquiryReservesSeats() } };
  }

  @Get('inquiries')
  async inquiries(@CurrentUser() user: AuthUser) {
    const rows = await this.prisma.groupInquiry.findMany({
      where: { OR: [{ organizerId: user.id }, { operatorId: user.id }] },
      include: { group: true, tour: true },
      orderBy: { createdAt: 'desc' },
    });
    return { data: rows.map((row) => this.inquiryCard(row, user.id)) };
  }

  @Patch('inquiries/:id')
  async inquiryStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: InquiryStatusDto) {
    const row = await this.prisma.groupInquiry.findUnique({ where: { id } });
    if (!row) throw new NotFoundException({ message: 'Inquiry was not found.', code: 'NOT_FOUND' });
    const operator = row.operatorId === user.id || user.role === Role.ADMIN;
    const organizerCancel = row.organizerId === user.id && dto.status === InquiryStatus.CANCELLED;
    if (!operator && !organizerCancel) throw new ForbiddenException({ message: 'You cannot change this inquiry.', code: 'INQUIRY' });
    const history = Array.isArray(row.statusHistory) ? [...row.statusHistory] : [];
    history.push({ status: dto.status, at: new Date().toISOString(), note: dto.note ?? null, seatsReserved: false });
    const updated = await this.prisma.groupInquiry.update({
      where: { id },
      data: { status: dto.status, statusHistory: history as Prisma.InputJsonValue },
      include: { group: true, tour: true },
    });
    const target = user.id === row.organizerId ? row.operatorId : row.organizerId;
    await this.notify(target, 'Inquiry updated', `Status is now ${dto.status}. Seats are not reserved by this update.`, 'INQUIRY');
    return { data: this.inquiryCard(updated, user.id) };
  }

  @Post('reports')
  async report(@CurrentUser() user: AuthUser, @Body() dto: ReportDto) {
    const row = await this.prisma.contentReport.create({
      data: { reporterId: user.id, targetType: dto.targetType, targetId: dto.targetId, reason: dto.reason.trim() },
    });
    return { data: { id: row.id, status: row.status } };
  }

  @Post('blocks')
  async block(@CurrentUser() user: AuthUser, @Body() dto: BlockDto) {
    if (dto.userId === user.id) throw new BadRequestException({ message: 'You cannot block yourself.', code: 'BLOCK' });
    await this.prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId: user.id, blockedId: dto.userId } },
      update: {},
      create: { blockerId: user.id, blockedId: dto.userId },
    });
    return { data: { ok: true } };
  }

  @Roles(Role.ADMIN)
  @Get('admin/queue')
  async adminQueue() {
    const [videos, reports, inquiries, contacts, groups] = await Promise.all([
      this.prisma.travelVideo.findMany({ orderBy: { createdAt: 'desc' }, take: 50, include: { creator: true } }),
      this.prisma.contentReport.findMany({ where: { status: 'OPEN' }, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.prisma.groupInquiry.findMany({ orderBy: { createdAt: 'desc' }, take: 50, include: { group: true } }),
      this.prisma.contactRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 50, include: { group: true } }),
      this.prisma.travelGroup.findMany({ orderBy: { createdAt: 'desc' }, take: 50, include: { _count: { select: { members: true } } } }),
    ]);
    return {
      data: {
        videos: videos.map((row) => ({ id: row.id, caption: row.caption, status: row.status, creator: row.creator.firstName, videoUrl: row.videoUrl })),
        reports,
        inquiries: inquiries.map((row) => ({ id: row.id, status: row.status, group: row.group.name, travelers: row.travelers })),
        contacts: contacts.map((row) => ({ id: row.id, status: row.status, group: row.group.name })),
        groups: groups.map((row) => ({ id: row.id, name: row.name, visibility: row.visibility, members: row._count.members, status: row.status })),
      },
    };
  }

  @Roles(Role.ADMIN)
  @Patch('admin/videos/:id')
  async moderateVideo(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ModerationDto) {
    await this.prisma.travelVideo.update({ where: { id }, data: { status: dto.status } });
    await this.prisma.auditLog.create({ data: { actorId: user.id, action: 'VIDEO_MODERATION', entity: 'TravelVideo', entityId: id, metadata: { status: dto.status } } });
    return { data: { id, status: dto.status } };
  }

  @Roles(Role.ADMIN)
  @Patch('admin/reports/:id')
  async moderateReport(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReportStatusDto) {
    await this.prisma.contentReport.update({ where: { id }, data: { status: dto.status } });
    await this.prisma.auditLog.create({ data: { actorId: user.id, action: 'REPORT_REVIEW', entity: 'ContentReport', entityId: id, metadata: { status: dto.status } } });
    return { data: { id, status: dto.status } };
  }

  private async resolveOperator(groupId: string, dto: InquiryDto) {
    if (dto.contactRequestId) {
      const request = await this.prisma.contactRequest.findFirst({
        where: { id: dto.contactRequestId, groupId, status: ContactRequestStatus.ACCEPTED },
      });
      if (!request) throw new BadRequestException({ message: 'Accept a contact request before using it for an inquiry.', code: 'INQUIRY' });
      return request.operatorId;
    }
    if (dto.tourId) {
      const tour = await this.prisma.tour.findUnique({ where: { id: dto.tourId }, include: { guide: true } });
      if (tour?.guide?.userId) return tour.guide.userId;
    }
    if (dto.proposalId) {
      const proposal = await this.prisma.tourProposal.findFirst({ where: { id: dto.proposalId, groupId }, include: { proposer: true } });
      if (proposal && isOperatorRole(proposal.proposer.role)) return proposal.proposerId;
    }
    throw new BadRequestException({ message: 'Choose an accepted operator contact or a tour with an operator account.', code: 'INQUIRY' });
  }

  private async memberConversation(id: string, userId: string) {
    const row = await this.prisma.conversation.findFirst({
      where: { id, members: { some: { userId } } },
      include: { group: true, members: true, messages: { include: { sender: true }, orderBy: { createdAt: 'asc' }, take: 80 } },
    });
    if (!row) throw new NotFoundException({ message: 'Conversation was not found.', code: 'NOT_FOUND' });
    return row;
  }

  private async organizerGroup(id: string, userId: string) {
    const group = await this.prisma.travelGroup.findUnique({ where: { id } });
    if (!group || group.organizerId !== userId) throw new ForbiddenException({ message: 'Only the organizer can do that.', code: 'GROUP' });
    return group;
  }

  private async requireMember(id: string, userId: string) {
    const group = await this.prisma.travelGroup.findUnique({ where: { id }, include: { members: true } });
    if (!group) throw new NotFoundException({ message: 'Group was not found.', code: 'NOT_FOUND' });
    const isMember = group.members.some((member) => member.userId === userId);
    if (!canReadGroupChat(isMember)) throw new ForbiddenException({ message: 'Join the group to read this conversation.', code: 'GROUP' });
    return group;
  }

  private async loadGroup(id: string) {
    const row = await this.prisma.travelGroup.findUnique({
      where: { id },
      include: {
        organizer: true,
        members: { include: { user: true } },
        joinRequests: { include: { user: true } },
        proposals: { include: { votes: true, tour: true }, orderBy: { createdAt: 'asc' } },
        polls: { include: { options: { include: { votes: true } } }, orderBy: { createdAt: 'asc' } },
        contactRequests: { include: { operator: true }, orderBy: { createdAt: 'desc' } },
        _count: { select: { members: true } },
      },
    });
    if (!row) throw new NotFoundException({ message: 'Group was not found.', code: 'NOT_FOUND' });
    return row;
  }

  private groupFilter(input: {
    q?: string;
    destination?: string;
    region?: string;
    date?: string;
    budget?: string;
    size?: string;
    visibility: GroupVisibility;
  }): Prisma.TravelGroupWhereInput {
    const size = Number(input.size);
    return {
      visibility: input.visibility,
      region: input.region || undefined,
      destinationName: input.destination ? { contains: input.destination, mode: 'insensitive' } : undefined,
      departureDate: input.date ? { gte: asDate(input.date) ?? undefined } : undefined,
      budgetPerPerson: input.budget && MONEY.test(input.budget) ? { lte: normalizeMoney(input.budget) } : undefined,
      desiredSize: Number.isInteger(size) && size > 0 ? { gte: size } : undefined,
      OR: input.q
        ? [
            { name: { contains: input.q, mode: 'insensitive' } },
            { destinationName: { contains: input.q, mode: 'insensitive' } },
          ]
        : undefined,
    };
  }

  private summary(row: Awaited<ReturnType<SocialController['loadGroup']>>) {
    const ranked = [...row.proposals].sort((left, right) => right.votes.length - left.votes.length);
    const popular = ranked[0];
    const poll = [...row.polls].reverse().find((item) => item.options.some((option) => option.votes.length > 0));
    const preferred = poll?.options.slice().sort((left, right) => right.votes.length - left.votes.length)[0];
    const price = popular ? decToString(popular.pricePerPerson) : null;
    return {
      popularTour: popular ? { id: popular.id, title: popular.title, votes: popular.votes.length } : null,
      preferredDate: preferred ? { label: preferred.label, votes: preferred.votes.length } : null,
      participants: row._count.members,
      estimatedTotal: price ? mulMoney(price, row._count.members) : null,
      selectedProposalId: row.selectedProposalId,
      seatsReserved: false,
      note: 'Votes and a selected proposal do not reserve seats.',
    };
  }

  private groupCard(row: {
    id: string;
    name: string;
    coverImageUrl: string | null;
    destinationName: string;
    region: string;
    description: string;
    departureDate: Date | null;
    budgetPerPerson: { toString(): string } | null;
    desiredSize: number;
    status: string;
    visibility: GroupVisibility;
    travelStyle: string | null;
    interests: string[];
    _count?: { members: number };
    members?: unknown[];
  }) {
    return {
      id: row.id,
      name: row.name,
      coverImageUrl: row.coverImageUrl,
      destinationName: row.destinationName,
      region: row.region,
      description: row.description,
      departureDate: isoDate(row.departureDate),
      budgetPerPerson: decToString(row.budgetPerPerson),
      desiredSize: row.desiredSize,
      memberCount: row._count?.members ?? row.members?.length ?? 0,
      status: row.status,
      visibility: row.visibility,
      travelStyle: row.travelStyle,
      interests: row.interests,
    };
  }

  private videoInclude(userId?: string) {
    return {
      creator: true,
      tour: true,
      group: true,
      _count: { select: { likes: true, comments: true } },
      likes: userId ? { where: { userId } } : false,
      saves: userId ? { where: { userId } } : false,
    } satisfies Prisma.TravelVideoInclude;
  }

  private videoCard(
    row: {
      id: string;
      caption: string;
      destinationName: string;
      region: string;
      posterUrl: string;
      videoUrl: string;
      status: VideoModeration;
      tourId: string | null;
      groupId: string | null;
      creator?: { firstName: string };
      tour?: { slug: string; title: string } | null;
      group?: { id: string; name: string } | null;
      _count?: { likes: number; comments: number };
      likes?: { id: string }[];
      saves?: { id: string }[];
    },
    _userId?: string,
  ) {
    return {
      id: row.id,
      caption: row.caption,
      destinationName: row.destinationName,
      region: row.region,
      posterUrl: row.posterUrl,
      videoUrl: row.videoUrl,
      status: row.status,
      tourId: row.tourId,
      tourSlug: row.tour?.slug ?? null,
      tourTitle: row.tour?.title ?? null,
      groupId: row.group?.id ?? row.groupId,
      groupName: row.group?.name ?? null,
      creator: row.creator?.firstName ?? 'Rohi',
      likes: row._count?.likes ?? 0,
      comments: row._count?.comments ?? 0,
      liked: (row.likes?.length ?? 0) > 0,
      saved: (row.saves?.length ?? 0) > 0,
    };
  }

  private inquiryCard(
    row: {
      id: string;
      status: InquiryStatus;
      travelers: number;
      proposedPrice: { toString(): string } | null;
      preferredDate: Date | null;
      notes: string | null;
      statusHistory: Prisma.JsonValue;
      organizerId: string;
      group: { id: string; name: string };
      tour: { slug: string; title: string } | null;
    },
    userId: string,
  ) {
    return {
      id: row.id,
      status: row.status,
      travelers: row.travelers,
      proposedPrice: decToString(row.proposedPrice),
      currency: 'TJS',
      preferredDate: isoDate(row.preferredDate),
      notes: row.notes,
      statusHistory: row.statusHistory,
      groupId: row.group.id,
      groupName: row.group.name,
      tourSlug: row.tour?.slug ?? null,
      tourTitle: row.tour?.title ?? null,
      incoming: row.organizerId !== userId,
      seatsReserved: inquiryReservesSeats(),
    };
  }

  private async publishedVideo(id: string) {
    const row = await this.prisma.travelVideo.findFirst({ where: { id, status: VideoModeration.PUBLISHED } });
    if (!row) throw new NotFoundException({ message: 'Video was not found.', code: 'NOT_FOUND' });
    return row;
  }

  private assertStored(url: string, pattern: RegExp, message: string) {
    if (!pattern.test(url)) throw new BadRequestException({ message, code: 'UPLOAD' });
  }

  private async system(groupId: string, body: string) {
    await this.prisma.groupMessage.create({ data: { groupId, body, system: true } });
  }

  private async notify(userId: string, title: string, body: string, type: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { notifyCompanions: true } });
    if (!user?.notifyCompanions) return;
    await this.prisma.notification.create({ data: { userId, title, body, type } });
  }

  private async firstName(id: string) {
    const row = await this.prisma.user.findUnique({ where: { id }, select: { firstName: true } });
    return row?.firstName ?? 'Traveler';
  }

  private async blocked(left: string, right: string) {
    const row = await this.prisma.userBlock.findFirst({
      where: { OR: [{ blockerId: left, blockedId: right }, { blockerId: right, blockedId: left }] },
    });
    return Boolean(row);
  }

  private async expireContacts(userId: string) {
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    await this.prisma.contactRequest.updateMany({
      where: {
        status: ContactRequestStatus.PENDING,
        createdAt: { lt: cutoff },
        OR: [{ operatorId: userId }, { group: { organizerId: userId } }],
      },
      data: { status: ContactRequestStatus.EXPIRED },
    });
  }
}

function asDate(value?: string | null): Date | null {
  if (!value) return null;
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return new Date(`${day}T00:00:00.000Z`);
}

function isoDate(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}
