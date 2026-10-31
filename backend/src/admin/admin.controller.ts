import { BadRequestException, Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { ListingStatus, Prisma, Role } from '../generated/prisma/client';
import { assertRoleChange, isRole } from '../common/authz';
import { slugify } from '../common/lang';
import { CurrentUser } from '../auth/current-user';
import { Roles } from '../auth/guards';
import { AuthUser } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

class RoleDto {
  @IsIn(['USER', 'GUIDE', 'PROVIDER', 'ADMIN'])
  role!: 'USER' | 'GUIDE' | 'PROVIDER' | 'ADMIN';
}

class SuspendDto {
  @IsBoolean()
  suspended!: boolean;
}

class ReviewListingDto {
  @IsIn(['PUBLISHED', 'REJECTED'])
  status!: 'PUBLISHED' | 'REJECTED';

  @IsOptional()
  @IsString()
  reviewNote?: string;
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get('stats')
  async stats() {
    const [users, destinations, tours, bookings, stays, guides, openCompanions, reviews, groups, videos, inquiries, openReports] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.destination.count({ where: { published: true } }),
      this.prisma.tour.count({ where: { published: true } }),
      this.prisma.booking.count(),
      this.prisma.accommodation.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.guideProfile.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.companionTrip.count({ where: { status: 'OPEN' } }),
      this.prisma.review.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.travelGroup.count(),
      this.prisma.travelVideo.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.groupInquiry.count(),
      this.prisma.contentReport.count({ where: { status: 'OPEN' } }),
    ]);
    const grouped = await this.prisma.booking.groupBy({ by: ['status'], _count: { status: true } });
    const pendingListings = await this.prisma.providerListing.count({ where: { status: 'PENDING_REVIEW' } });
    return {
      data: {
        users,
        destinations,
        tours,
        bookings,
        stays,
        guides,
        openCompanions,
        reviews,
        groups,
        videos,
        inquiries,
        openReports,
        pendingListings,
        bookingsByStatus: Object.fromEntries(grouped.map((row) => [row.status, row._count.status])),
      },
    };
  }

  @Get('users')
  async users() {
    const rows = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        language: true,
        deletionRequestedAt: true,
        suspendedAt: true,
        createdAt: true,
      },
    });
    return { data: rows };
  }

  @Patch('users/:id/role')
  async role(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: RoleDto) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new BadRequestException({ message: 'User was not found.', code: 'NOT_FOUND' });
    const adminCount = await this.prisma.user.count({ where: { role: 'ADMIN' } });
    const problem = assertRoleChange({
      actorRole: actor.role,
      actorId: actor.id,
      targetId: target.id,
      targetRole: target.role,
      nextRole: dto.role,
      adminCount,
    });
    if (problem) {
      throw new BadRequestException({
        message:
          problem === 'SELF'
            ? 'You cannot change your own role.'
            : problem === 'LAST_ADMIN'
              ? 'Keep at least one administrator.'
              : 'That role change is not allowed.',
        code: problem,
      });
    }
    if (!isRole(dto.role)) {
      throw new BadRequestException({ message: 'Unknown role.', code: 'ROLE' });
    }
    await this.prisma.user.update({ where: { id }, data: { role: dto.role } });
    await this.prisma.auditLog.create({
      data: { actorId: actor.id, action: 'ROLE_CHANGE', entity: 'User', entityId: id, metadata: { role: dto.role } },
    });
    return { data: { id, role: dto.role } };
  }

  @Patch('users/:id/suspension')
  async suspension(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: SuspendDto) {
    if (actor.id === id) throw new BadRequestException({ message: 'You cannot suspend your own account.', code: 'SELF' });
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new BadRequestException({ message: 'User was not found.', code: 'NOT_FOUND' });
    await this.prisma.user.update({ where: { id }, data: { suspendedAt: dto.suspended ? new Date() : null } });
    if (dto.suspended) {
      await this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await this.prisma.auditLog.create({
      data: { actorId: actor.id, action: dto.suspended ? 'SUSPEND' : 'REINSTATE', entity: 'User', entityId: id },
    });
    return { data: { id, suspended: dto.suspended } };
  }

  @Patch('provider-listings/:id')
  async reviewListing(@CurrentUser() actor: AuthUser, @Param('id') id: string, @Body() dto: ReviewListingDto) {
    const listing = await this.prisma.providerListing.findUnique({ where: { id } });
    if (!listing) throw new BadRequestException({ message: 'Listing was not found.', code: 'NOT_FOUND' });
    await this.prisma.providerListing.update({
      where: { id },
      data: { status: dto.status as ListingStatus, reviewNote: dto.reviewNote },
    });
    if (dto.status === 'PUBLISHED' && listing.kind === 'ACCOMMODATION') {
      await this.prisma.accommodation.create({
        data: {
          slug: `${slugify(listing.name)}-${id.slice(0, 6)}`,
          name: listing.name,
          type: 'GUESTHOUSE',
          region: listing.region,
          copy: {
            en: { summary: listing.description.slice(0, 240), description: listing.description },
          } as Prisma.InputJsonValue,
          contactEmail: listing.contactEmail,
          contactPhone: listing.contactPhone,
          priceNote: listing.priceNote ?? 'Price was not confirmed.',
          services: listing.services,
          status: 'PUBLISHED',
          verified: false,
          ownerId: listing.ownerId,
          searchText: `${listing.name} ${listing.region} ${listing.description}`.toLowerCase(),
        },
      });
    }
    if (dto.status === 'PUBLISHED' && listing.kind !== 'ACCOMMODATION') {
      await this.prisma.guideProfile.create({
        data: {
          userId: listing.ownerId,
          displayName: listing.name,
          region: listing.region,
          languages: [],
          specialties: listing.services,
          bio: listing.description,
          priceNote: listing.priceNote,
          contactEmail: listing.contactEmail,
          contactPhone: listing.contactPhone,
          services: listing.services,
          kind: listing.kind,
          status: 'PUBLISHED',
          verified: false,
          searchText: `${listing.name} ${listing.region}`.toLowerCase(),
        },
      });
      const owner = await this.prisma.user.findUnique({ where: { id: listing.ownerId } });
      if (owner && owner.role === 'USER') {
        await this.prisma.user.update({
          where: { id: owner.id },
          data: { role: listing.kind === 'GUIDE' ? 'GUIDE' : 'PROVIDER' },
        });
      }
    }
    await this.prisma.auditLog.create({
      data: { actorId: actor.id, action: 'LISTING_REVIEW', entity: 'ProviderListing', entityId: id, metadata: { status: dto.status } },
    });
    return { data: { id, status: dto.status, verified: false } };
  }

  @Get('reports')
  async reports() {
    const rows = await this.prisma.userReport.findMany({
      include: { reporter: true, reported: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return {
      data: rows.map((row) => ({
        id: row.id,
        reason: row.reason,
        details: row.details,
        status: row.status,
        reporter: row.reporter.email,
        reported: row.reported.email,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  @Get('ai')
  ai() {
    const base = this.config.get<string>('AI_BASE_URL') ?? '';
    let host = '';
    try {
      host = base ? new URL(base).host : '';
    } catch {
      host = '';
    }
    return {
      data: {
        configured: Boolean(this.config.get<string>('AI_API_KEY')),
        model: this.config.get<string>('AI_MODEL') ?? 'gpt-4o-mini',
        host,
      },
    };
  }
}
