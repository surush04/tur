import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Prisma } from '../generated/prisma/client';
import { addMoney, decToString, normalizeMoney } from '../common/money';
import { CurrentUser } from '../auth/current-user';
import { AuthUser } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

class ActivityDto {
  @IsString() @MinLength(2) @MaxLength(160) title!: string;
  @IsOptional() @IsString() placeName?: string;
  @IsString() @MaxLength(2000) description!: string;
  @IsString() @MaxLength(300) timeEstimateNote!: string;
  @IsOptional() @IsString() transportNote?: string;
  @IsOptional() @IsString() estimatedCost?: string;
  @IsOptional() @IsUUID() tourId?: string;
  @IsInt() @Min(0) sortOrder!: number;
}

class DayDto {
  @IsInt() @Min(1) dayNumber!: number;
  @IsString() title!: string;
  @IsOptional() @IsString() notes?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActivityDto)
  activities!: ActivityDto[];
}

class SaveItineraryDto {
  @IsString() title!: string;
  @IsString() startLocation!: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsString() endDate?: string;
  @IsInt() @Min(1) travelers!: number;
  @IsString() budgetTjs!: string;
  @IsArray() @IsString({ each: true }) interests!: string[];
  @IsOptional() @IsString() travelStyle?: string;
  @IsOptional() @IsString() transport?: string;
  @IsOptional() @IsString() accommodationPref?: string;
  @IsOptional() @IsString() accessibility?: string;
  @IsIn(['AI', 'DEMO']) source!: 'AI' | 'DEMO';
  @IsString() disclaimer!: string;
  @IsArray() @IsString({ each: true }) assumptions!: string[];
  @IsArray() @IsString({ each: true }) packing!: string[];
  @IsOptional() @IsString() alternatives?: string;
  @IsOptional() budgetShortfall?: boolean;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DayDto)
  days!: DayDto[];
}

class ActivityPatchDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() estimatedCost?: string | null;
}

@ApiTags('itineraries')
@ApiBearerAuth()
@Controller('itineraries')
export class ItinerariesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const rows = await this.prisma.itinerary.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    });
    return {
      data: rows.map((row) => ({
        id: row.id,
        title: row.title,
        source: row.source,
        totalEstimate: decToString(row.totalEstimate),
        startDate: row.startDate?.toISOString().slice(0, 10) ?? null,
        endDate: row.endDate?.toISOString().slice(0, 10) ?? null,
        budgetShortfall: row.budgetShortfall,
      })),
    };
  }

  @Get(':id')
  async one(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const row = await this.owned(user.id, id);
    return { data: await this.present(row) };
  }

  @Post()
  async save(@CurrentUser() user: AuthUser, @Body() dto: SaveItineraryDto) {
    const total = this.sum(dto.days);
    const created = await this.prisma.itinerary.create({
      data: {
        userId: user.id,
        title: dto.title,
        startLocation: dto.startLocation,
        region: dto.region,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        travelers: dto.travelers,
        budgetTjs: normalizeMoney(dto.budgetTjs),
        interests: dto.interests,
        travelStyle: dto.travelStyle,
        transport: dto.transport,
        accommodationPref: dto.accommodationPref,
        accessibility: dto.accessibility,
        source: dto.source,
        disclaimer: dto.disclaimer,
        assumptions: dto.assumptions,
        packing: dto.packing,
        alternatives: dto.alternatives,
        budgetShortfall: Boolean(dto.budgetShortfall),
        totalEstimate: total,
        days: {
          create: dto.days.map((day) => ({
            dayNumber: day.dayNumber,
            title: day.title,
            notes: day.notes,
            activities: {
              create: day.activities.map((activity) => ({
                title: activity.title,
                placeName: activity.placeName,
                description: activity.description,
                timeEstimateNote: activity.timeEstimateNote,
                transportNote: activity.transportNote,
                estimatedCost: activity.estimatedCost ? normalizeMoney(activity.estimatedCost) : null,
                tourId: activity.tourId,
                sortOrder: activity.sortOrder,
              })),
            },
          })),
        },
      },
    });
    return { data: { id: created.id } };
  }

  @Patch(':id/budget')
  async budget(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body('budgetTjs') budgetTjs: string) {
    await this.owned(user.id, id);
    await this.prisma.itinerary.update({
      where: { id },
      data: { budgetTjs: normalizeMoney(budgetTjs) },
    });
    return { data: { id } };
  }

  @Patch(':id/activities/:activityId')
  async editActivity(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('activityId') activityId: string,
    @Body() dto: ActivityPatchDto,
  ) {
    await this.owned(user.id, id);
    const activity = await this.prisma.itineraryActivity.findFirst({
      where: { id: activityId, day: { itineraryId: id } },
    });
    if (!activity) throw new BadRequestException({ message: 'Activity was not found.', code: 'NOT_FOUND' });
    await this.prisma.itineraryActivity.update({
      where: { id: activityId },
      data: {
        title: dto.title,
        description: dto.description,
        estimatedCost: dto.estimatedCost ? normalizeMoney(dto.estimatedCost) : dto.estimatedCost === null ? null : undefined,
      },
    });
    await this.recalculate(id);
    return { data: { id: activityId } };
  }

  @Delete(':id/activities/:activityId')
  async removeActivity(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('activityId') activityId: string) {
    await this.owned(user.id, id);
    await this.prisma.itineraryActivity.deleteMany({ where: { id: activityId, day: { itineraryId: id } } });
    await this.recalculate(id);
    return { data: { ok: true } };
  }

  private sum(days: DayDto[]) {
    return days.reduce((total, day) => {
      return day.activities.reduce((inner, activity) => {
        return activity.estimatedCost ? addMoney(inner, normalizeMoney(activity.estimatedCost)) : inner;
      }, total);
    }, '0.00');
  }

  private async recalculate(id: string) {
    const days = await this.prisma.itineraryDay.findMany({
      where: { itineraryId: id },
      include: { activities: true },
    });
    const total = days.reduce((sum, day) => {
      return day.activities.reduce((inner, activity) => {
        return activity.estimatedCost ? addMoney(inner, decToString(activity.estimatedCost) ?? '0.00') : inner;
      }, sum);
    }, '0.00');
    await this.prisma.itinerary.update({ where: { id }, data: { totalEstimate: total } });
  }

  private async owned(userId: string, id: string) {
    const row = await this.prisma.itinerary.findFirst({
      where: { id, userId },
      include: { days: { include: { activities: true }, orderBy: { dayNumber: 'asc' } } },
    });
    if (!row) throw new BadRequestException({ message: 'Itinerary was not found.', code: 'NOT_FOUND' });
    return row;
  }

  private async present(row: Prisma.ItineraryGetPayload<{ include: { days: { include: { activities: true } } } }>) {
    const tourIds = row.days.flatMap((day) => day.activities.map((activity) => activity.tourId).filter((id): id is string => Boolean(id)));
    const tours = tourIds.length
      ? await this.prisma.tour.findMany({ where: { id: { in: tourIds } }, select: { id: true, slug: true } })
      : [];
    const slugs = new Map(tours.map((tour) => [tour.id, tour.slug]));
    return {
      id: row.id,
      title: row.title,
      startLocation: row.startLocation,
      region: row.region,
      startDate: row.startDate?.toISOString().slice(0, 10) ?? null,
      endDate: row.endDate?.toISOString().slice(0, 10) ?? null,
      travelers: row.travelers,
      budgetTjs: decToString(row.budgetTjs),
      interests: row.interests,
      travelStyle: row.travelStyle,
      transport: row.transport,
      accommodationPref: row.accommodationPref,
      accessibility: row.accessibility,
      source: row.source,
      disclaimer: row.disclaimer,
      assumptions: row.assumptions,
      packing: row.packing,
      alternatives: row.alternatives,
      budgetShortfall: row.budgetShortfall,
      totalEstimate: decToString(row.totalEstimate),
      days: row.days.map((day) => ({
        id: day.id,
        dayNumber: day.dayNumber,
        title: day.title,
        notes: day.notes,
        activities: day.activities
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((activity) => ({
            id: activity.id,
            title: activity.title,
            placeName: activity.placeName,
            description: activity.description,
            timeEstimateNote: activity.timeEstimateNote,
            transportNote: activity.transportNote,
            estimatedCost: decToString(activity.estimatedCost),
            tourId: activity.tourId,
            tourSlug: activity.tourId ? slugs.get(activity.tourId) ?? null : null,
            sortOrder: activity.sortOrder,
          })),
      })),
    };
  }
}
