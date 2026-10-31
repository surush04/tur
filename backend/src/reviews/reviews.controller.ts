import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ReviewStatus, Role } from '../generated/prisma/client';
import { CurrentUser } from '../auth/current-user';
import { Public, Roles } from '../auth/guards';
import { AuthUser } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

class ReviewDto {
  @IsInt() @Min(1) @Max(5) rating!: number;
  @IsString() @MinLength(4) @MaxLength(1000) comment!: string;
  @IsOptional() @IsUUID() tourId?: string;
  @IsOptional() @IsUUID() accommodationId?: string;
  @IsOptional() @IsUUID() guideId?: string;
}

class ModerateReviewDto {
  @IsIn(['PUBLISHED', 'HIDDEN']) status!: 'PUBLISHED' | 'HIDDEN';
}

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async list(
    @Query('tourId') tourId?: string,
    @Query('accommodationId') accommodationId?: string,
    @Query('guideId') guideId?: string,
  ) {
    const rows = await this.prisma.review.findMany({
      where: { status: 'PUBLISHED', tourId, accommodationId, guideId },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return {
      data: rows.map((row) => ({
        id: row.id,
        rating: row.rating,
        comment: row.comment,
        createdAt: row.createdAt.toISOString(),
        author: row.user.showProfilePublicly ? row.user.firstName : 'Traveler',
      })),
    };
  }

  @ApiBearerAuth()
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: ReviewDto) {
    const targets = [dto.tourId, dto.accommodationId, dto.guideId].filter(Boolean);
    if (targets.length !== 1) {
      throw new BadRequestException({ message: 'A review needs one tour, stay, or guide.', code: 'VALIDATION' });
    }
    const duplicate = await this.prisma.review.findFirst({
      where: { userId: user.id, tourId: dto.tourId, accommodationId: dto.accommodationId, guideId: dto.guideId },
    });
    if (duplicate) {
      throw new BadRequestException({ message: 'You already reviewed this listing.', code: 'CONFLICT' });
    }
    const row = await this.prisma.review.create({
      data: {
        userId: user.id,
        rating: dto.rating,
        comment: dto.comment.trim(),
        tourId: dto.tourId,
        accommodationId: dto.accommodationId,
        guideId: dto.guideId,
      },
    });
    return { data: { id: row.id } };
  }

  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Get('manage')
  async manage() {
    const rows = await this.prisma.review.findMany({
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return {
      data: rows.map((row) => ({
        id: row.id,
        rating: row.rating,
        comment: row.comment,
        status: row.status,
        author: row.user.email,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Patch(':id')
  async moderate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ModerateReviewDto) {
    await this.prisma.review.update({ where: { id }, data: { status: dto.status as ReviewStatus } });
    await this.prisma.auditLog.create({
      data: { actorId: user.id, action: 'REVIEW_MODERATE', entity: 'Review', entityId: id, metadata: { status: dto.status } },
    });
    return { data: { id, status: dto.status } };
  }
}
