import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { CurrentUser } from '../auth/current-user';
import { AuthUser } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

class FavoriteDto {
  @IsOptional() @IsUUID() destinationId?: string;
  @IsOptional() @IsUUID() tourId?: string;
  @IsOptional() @IsUUID() accommodationId?: string;
  @IsOptional() @IsUUID() guideId?: string;
}

@ApiTags('favorites')
@ApiBearerAuth()
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const rows = await this.prisma.favorite.findMany({
      where: { userId: user.id },
      include: {
        destination: true,
        tour: { include: { destination: true } },
        accommodation: true,
        guide: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return {
      data: rows.map((row) => ({
        id: row.id,
        destinationId: row.destinationId,
        tourId: row.tourId,
        accommodationId: row.accommodationId,
        guideId: row.guideId,
        title: row.destination?.name ?? row.tour?.title ?? row.accommodation?.name ?? row.guide?.displayName ?? 'Saved',
        subtitle: row.destination?.region ?? row.tour?.destination.region ?? row.accommodation?.region ?? row.guide?.region ?? '',
        image: row.destination?.coverImageUrl ?? row.tour?.coverImageUrl ?? row.accommodation?.coverImageUrl ?? row.guide?.coverImageUrl,
        href: row.destination
          ? `/tabs/destination/${row.destination.slug}`
          : row.tour
            ? `/tabs/tour/${row.tour.slug}`
            : row.accommodation
              ? `/tabs/stay/${row.accommodation.slug}`
              : `/tabs/guide/${row.guideId}`,
      })),
    };
  }

  @Post()
  async add(@CurrentUser() user: AuthUser, @Body() dto: FavoriteDto) {
    const targets = [dto.destinationId, dto.tourId, dto.accommodationId, dto.guideId].filter(Boolean);
    if (targets.length !== 1) {
      return { data: null, message: 'Choose one item to save.' };
    }
    const existing = await this.prisma.favorite.findFirst({
      where: {
        userId: user.id,
        destinationId: dto.destinationId ?? undefined,
        tourId: dto.tourId ?? undefined,
        accommodationId: dto.accommodationId ?? undefined,
        guideId: dto.guideId ?? undefined,
      },
    });
    if (existing) return { data: existing };
    const created = await this.prisma.favorite.create({
      data: {
        userId: user.id,
        destinationId: dto.destinationId,
        tourId: dto.tourId,
        accommodationId: dto.accommodationId,
        guideId: dto.guideId,
      },
    });
    return { data: created };
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.prisma.favorite.deleteMany({ where: { id, userId: user.id } });
    return { data: { ok: true } };
  }
}
