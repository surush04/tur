import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ListingStatus, Prisma, Role } from '../generated/prisma/client';
import { decToString } from '../common/money';
import { AppLang, localize, requestLang } from '../common/lang';
import { CurrentUser } from '../auth/current-user';
import { Public, Roles } from '../auth/guards';
import { OptionalJwtGuard } from '../auth/optional-jwt.guard';
import { AuthUser } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

class ProviderListingDto {
  @IsIn(['ACCOMMODATION', 'GUIDE', 'DRIVER', 'ACTIVITY'])
  kind!: string;

  @IsString() @MinLength(2) @MaxLength(140) name!: string;
  @IsString() @MaxLength(40) region!: string;
  @IsString() @MinLength(10) @MaxLength(2000) description!: string;
  @IsEmail() contactEmail!: string;
  @IsOptional() @IsString() @MaxLength(40) contactPhone?: string;
  @IsOptional() @IsString() @MaxLength(200) priceNote?: string;
  @IsArray() @IsString({ each: true }) services!: string[];
}

@ApiTags('accommodations')
@Controller('accommodations')
export class AccommodationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async list(@Query('q') q: string | undefined, @Query('region') region: string | undefined, @Headers('accept-language') lang?: string) {
    const rows = await this.prisma.accommodation.findMany({
      where: {
        status: 'PUBLISHED',
        region: region || undefined,
        searchText: q ? { contains: q.toLowerCase() } : undefined,
      },
      orderBy: { name: 'asc' },
    });
    return { data: rows.map((row) => this.card(row, requestLang(lang), false)) };
  }

  @Public()
  @UseGuards(OptionalJwtGuard)
  @Get(':slug')
  async one(
    @Param('slug') slug: string,
    @Headers('accept-language') lang?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    const row = await this.prisma.accommodation.findFirst({
      where: { slug, status: 'PUBLISHED' },
      include: { images: true, reviews: { where: { status: 'PUBLISHED' }, include: { user: true } } },
    });
    if (!row) return { data: null };
    const signedIn = Boolean(user?.id);
    return {
      data: {
        ...this.card(row, requestLang(lang), signedIn),
        description: localize(row.copy, requestLang(lang)).description,
        services: row.services,
        images: row.images.map((image) => ({ url: image.url, alt: image.alt, credit: image.credit })),
        latitude: decToString(row.latitude),
        longitude: decToString(row.longitude),
        reviews: row.reviews.map((review) => ({
          id: review.id,
          rating: review.rating,
          comment: review.comment,
          author: review.user.showProfilePublicly ? review.user.firstName : 'Traveler',
          createdAt: review.createdAt.toISOString(),
        })),
      },
    };
  }

  private card(
    row: {
      id: string;
      slug: string;
      name: string;
      type: string;
      region: string;
      copy: Prisma.JsonValue;
      priceRangeMin: Prisma.Decimal | null;
      priceRangeMax: Prisma.Decimal | null;
      priceNote: string | null;
      coverImageUrl: string | null;
      contactEmail: string | null;
      contactPhone: string | null;
      verified: boolean;
    },
    lang: AppLang,
    includeContact: boolean,
  ) {
    const copy = localize(row.copy, lang);
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      type: row.type,
      region: row.region,
      summary: copy.summary,
      priceRangeMin: decToString(row.priceRangeMin),
      priceRangeMax: decToString(row.priceRangeMax),
      priceNote: row.priceNote,
      coverImageUrl: row.coverImageUrl,
      verified: false,
      contactEmail: includeContact ? row.contactEmail : null,
      contactPhone: includeContact ? row.contactPhone : null,
    };
  }
}

@ApiTags('guides')
@Controller('guides')
export class GuidesController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async list(@Query('q') q?: string, @Query('kind') kind?: string, @Query('region') region?: string) {
    const rows = await this.prisma.guideProfile.findMany({
      where: {
        status: 'PUBLISHED',
        kind: kind || undefined,
        region: region || undefined,
        searchText: q ? { contains: q.toLowerCase() } : undefined,
      },
      orderBy: { displayName: 'asc' },
    });
    return { data: rows.map((row) => this.card(row, false)) };
  }

  @Public()
  @UseGuards(OptionalJwtGuard)
  @Get(':id')
  async one(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    const row = await this.prisma.guideProfile.findFirst({
      where: { id, status: 'PUBLISHED' },
      include: { reviews: { where: { status: 'PUBLISHED' }, include: { user: true } } },
    });
    if (!row) return { data: null };
    return {
      data: {
        ...this.card(row, Boolean(user?.id)),
        bio: row.bio,
        languages: row.languages,
        services: row.services,
        yearsExperience: row.yearsExperience,
        reviews: row.reviews.map((review) => ({
          id: review.id,
          rating: review.rating,
          comment: review.comment,
          author: review.user.showProfilePublicly ? review.user.firstName : 'Traveler',
        })),
      },
    };
  }

  private card(
    row: {
      id: string;
      displayName: string;
      region: string;
      kind: string;
      specialties: string[];
      priceNote: string | null;
      coverImageUrl: string | null;
      contactEmail: string | null;
      contactPhone: string | null;
    },
    includeContact: boolean,
  ) {
    return {
      id: row.id,
      displayName: row.displayName,
      region: row.region,
      kind: row.kind,
      specialties: row.specialties,
      priceNote: row.priceNote,
      coverImageUrl: row.coverImageUrl,
      verified: false,
      contactEmail: includeContact ? row.contactEmail : null,
      contactPhone: includeContact ? row.contactPhone : null,
    };
  }
}

@ApiTags('provider-listings')
@ApiBearerAuth()
@Controller('provider-listings')
export class ProviderListingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async submit(@CurrentUser() user: AuthUser, @Body() dto: ProviderListingDto) {
    const row = await this.prisma.providerListing.create({
      data: {
        ownerId: user.id,
        kind: dto.kind,
        name: dto.name.trim(),
        region: dto.region,
        description: dto.description.trim(),
        contactEmail: dto.contactEmail.toLowerCase(),
        contactPhone: dto.contactPhone?.trim(),
        priceNote: dto.priceNote?.trim(),
        services: dto.services,
        status: ListingStatus.PENDING_REVIEW,
      },
    });
    return {
      data: {
        id: row.id,
        status: row.status,
        message: 'Submitted for administrator review. This listing is not published and is not certified.',
      },
    };
  }

  @Get('mine')
  async mine(@CurrentUser() user: AuthUser) {
    const rows = await this.prisma.providerListing.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    return { data: rows };
  }

  @Roles(Role.ADMIN)
  @Get('manage')
  async manage() {
    const rows = await this.prisma.providerListing.findMany({
      include: { owner: true },
      orderBy: { createdAt: 'desc' },
    });
    return {
      data: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        name: row.name,
        region: row.region,
        description: row.description,
        status: row.status,
        services: row.services,
        priceNote: row.priceNote,
        ownerEmail: row.owner.email,
        reviewNote: row.reviewNote,
      })),
    };
  }
}
