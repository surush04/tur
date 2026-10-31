import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DateStatus, Difficulty, Prisma } from '../generated/prisma/client';
import { decToString } from '../common/money';
import { AppLang, localize, pageArgs, slugify, todayUtc } from '../common/lang';
import { PrismaService } from '../prisma/prisma.service';
import { OwnerTourDto, TourDateDto, TourQueryDto, UpsertTourDto } from './catalog.dto';
import { tourRatings } from './ratings';

const STORED_IMAGE = /^\/uploads\/[a-f0-9]{32}\.(jpe?g|png|webp)$/;

const tourInclude = {
  images: true,
  dates: true,
  destination: true,
  guide: true,
  reviews: { where: { status: 'PUBLISHED' as const }, include: { user: true } },
  owner: { select: { firstName: true, lastName: true, telegramHandle: true, whatsappHandle: true } },
} satisfies Prisma.TourInclude;

type TourRecord = Prisma.TourGetPayload<{ include: typeof tourInclude }>;

@Injectable()
export class ToursService {
  constructor(private readonly prisma: PrismaService) {}

  private present(row: TourRecord, lang: AppLang, rating: { rating: number | null; ratingCount: number }, revealContacts = false) {
    const copy = localize(row.copy, lang);
    return {
      id: row.id,
      slug: row.slug,
      title: copy.title ?? row.title,
      summary: copy.summary,
      description: copy.description,
      tips: copy.tips ?? null,
      category: row.category,
      difficulty: row.difficulty,
      durationDays: row.durationDays,
      meetingPoint: row.meetingPoint,
      included: row.included,
      excluded: row.excluded,
      cancellationPolicy: row.cancellationPolicy,
      pricePerPerson: decToString(row.pricePerPerson),
      currency: row.currency,
      priceNote: 'Catalog price per person. A booking is a request until an administrator confirms it. No payment is collected in the app.',
      published: row.published,
      coverImageUrl: row.coverImageUrl,
      images: row.images
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((image) => ({ url: image.url, alt: image.alt, credit: image.credit })),
      destination: {
        id: row.destination.id,
        slug: row.destination.slug,
        name: row.destination.name,
        region: row.destination.region,
        latitude: decToString(row.destination.latitude),
        longitude: decToString(row.destination.longitude),
      },
      owner: row.owner
        ? {
            name: `${row.owner.firstName} ${row.owner.lastName}`.trim(),
            telegram: revealContacts ? row.owner.telegramHandle || null : null,
            whatsapp: revealContacts ? row.owner.whatsappHandle || null : null,
            phone: revealContacts ? row.contactPhone || null : null,
          }
        : null,
      guide: row.guide
        ? {
            id: row.guide.id,
            displayName: row.guide.displayName,
            region: row.guide.region,
            bio: row.guide.bio,
            languages: row.guide.languages,
            verified: false,
          }
        : null,
      dates: row.dates
        .filter((date) => date.status === 'OPEN' && date.startDate.toISOString().slice(0, 10) >= todayUtc())
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
        .map((date) => ({
          id: date.id,
          startDate: date.startDate.toISOString().slice(0, 10),
          endDate: date.endDate.toISOString().slice(0, 10),
          capacity: date.capacity,
          bookedSeats: date.bookedSeats,
          remaining: Math.max(0, date.capacity - date.bookedSeats),
          status: date.status,
        })),
      reviews: row.reviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt.toISOString(),
        author: review.user.showProfilePublicly ? review.user.firstName : 'Traveler',
      })),
      rating: rating.rating,
      ratingCount: rating.ratingCount,
    };
  }

  async list(query: TourQueryDto, lang: AppLang, includeUnpublished = false) {
    const page = pageArgs(query.page, query.pageSize);
    const where: Prisma.TourWhereInput = {
      published: includeUnpublished ? undefined : true,
      category: query.category,
      difficulty: query.difficulty as Difficulty | undefined,
      durationDays: query.duration,
      pricePerPerson: {
        gte: query.minPrice,
        lte: query.maxPrice,
      },
      destination: query.destination ? { slug: query.destination } : undefined,
      searchText: query.q ? { contains: query.q.toLowerCase() } : undefined,
      dates:
        query.date || query.groupSize
          ? {
              some: {
                status: 'OPEN',
                startDate: query.date ? new Date(`${query.date}T00:00:00.000Z`) : undefined,
                bookedSeats: query.groupSize ? undefined : undefined,
              },
            }
          : undefined,
    };
    if (query.groupSize) {
      where.dates = {
        some: {
          status: 'OPEN',
          startDate: query.date ? new Date(`${query.date}T00:00:00.000Z`) : { gte: new Date(`${todayUtc()}T00:00:00.000Z`) },
        },
      };
    }
    const [rows, total] = await Promise.all([
      this.prisma.tour.findMany({
        where,
        include: tourInclude,
        skip: page.skip,
        take: page.take,
        orderBy: query.sort === 'price_desc' ? { pricePerPerson: 'desc' } : { pricePerPerson: 'asc' },
      }),
      this.prisma.tour.count({ where }),
    ]);
    const ratings = await tourRatings(this.prisma, rows.map((row) => row.id));
    let data = rows
      .filter((row) => {
        if (!query.groupSize) return true;
        return row.dates.some((date) => date.capacity - date.bookedSeats >= query.groupSize!);
      })
      .map((row) => this.present(row, lang, ratings.get(row.id) ?? { rating: null, ratingCount: 0 }));
    if (query.sort === 'rating') {
      data = [...data].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    }
    return { data, meta: { page: page.page, pageSize: page.pageSize, total } };
  }

  async bySlug(slug: string, lang: AppLang, viewerId?: string) {
    const row = await this.prisma.tour.findFirst({
      where: { slug, published: true },
      include: tourInclude,
    });
    if (!row) throw new NotFoundException({ message: 'Tour was not found.', code: 'NOT_FOUND' });
    await this.prisma.tour.update({ where: { id: row.id }, data: { viewCount: { increment: 1 } } });
    const ratings = await tourRatings(this.prisma, [row.id]);
    return { data: this.present(row, lang, ratings.get(row.id) ?? { rating: null, ratingCount: 0 }, Boolean(viewerId)) };
  }

  async create(dto: UpsertTourDto, actorId: string) {
    const slug = dto.slug?.trim() || slugify(dto.title);
    const created = await this.prisma.tour.create({ data: this.data(dto, slug) });
    await this.audit(actorId, 'TOUR_CREATE', created.id);
    return { data: { id: created.id, slug: created.slug } };
  }

  async update(id: string, dto: UpsertTourDto, actorId: string) {
    const slug = dto.slug?.trim() || slugify(dto.title);
    await this.prisma.tourImage.deleteMany({ where: { tourId: id } });
    await this.prisma.tour.update({ where: { id }, data: this.data(dto, slug) });
    await this.audit(actorId, 'TOUR_UPDATE', id);
    return { data: { id, slug } };
  }

  async dashboard(userId: string) {
    const [tours, videos, groups] = await Promise.all([
      this.prisma.tour.findMany({ where: { ownerId: userId }, orderBy: { updatedAt: 'desc' } }),
      this.prisma.travelVideo.findMany({ where: { creatorId: userId }, orderBy: { createdAt: 'desc' }, take: 8 }),
      this.prisma.travelGroup.findMany({
        where: { organizerId: userId },
        include: { _count: { select: { members: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
    ]);
    return {
      data: {
        views: tours.reduce((sum, tour) => sum + tour.viewCount, 0),
        tours: tours.map((tour) => ({
          id: tour.id,
          slug: tour.slug,
          title: tour.title,
          pricePerPerson: decToString(tour.pricePerPerson),
          published: tour.published,
          viewCount: tour.viewCount,
          durationDays: tour.durationDays,
        })),
        videos: videos.map((video) => ({ id: video.id, caption: video.caption, status: video.status })),
        groups: groups.map((group) => ({ id: group.id, name: group.name, memberCount: group._count.members, desiredSize: group.desiredSize })),
      },
    };
  }

  async ownerTour(userId: string, id: string) {
    const row = await this.prisma.tour.findFirst({
      where: { id, ownerId: userId },
      include: { images: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!row) throw new ForbiddenException({ message: 'This tour is not yours.', code: 'FORBIDDEN' });
    const copy = row.copy as { tg?: { summary?: string; description?: string } };
    return {
      data: {
        id: row.id,
        destinationId: row.destinationId,
        title: row.title,
        summary: copy.tg?.summary ?? '',
        description: copy.tg?.description ?? '',
        category: row.category,
        difficulty: row.difficulty,
        durationDays: row.durationDays,
        meetingPoint: row.meetingPoint,
        included: row.included.join(', '),
        pricePerPerson: decToString(row.pricePerPerson),
        contactPhone: row.contactPhone ?? '',
        published: row.published,
        coverImageUrl: row.coverImageUrl ?? '',
        imageUrls: row.images.map((image) => image.url),
      },
    };
  }

  async ownerSave(userId: string, dto: OwnerTourDto, id?: string) {
    const destination = await this.prisma.destination.findUnique({ where: { id: dto.destinationId } });
    if (!destination) throw new BadRequestException({ message: 'Choose a place from the catalog.', code: 'PLACE' });
    await this.prisma.user.updateMany({ where: { id: userId, role: 'USER' }, data: { role: 'PROVIDER' } });
    const copy = {
      tg: { title: dto.title.trim(), summary: dto.summary.trim(), description: dto.description.trim() },
      ru: { title: dto.title.trim(), summary: dto.summary.trim(), description: dto.description.trim() },
      en: { title: dto.title.trim(), summary: dto.summary.trim(), description: dto.description.trim() },
    };
    const included = (dto.included ?? '').split(',').map((item) => item.trim()).filter(Boolean);
    const media = this.mediaOf(dto);
    const shared = {
      title: dto.title.trim(),
      copy,
      category: dto.category,
      difficulty: dto.difficulty,
      durationDays: dto.durationDays,
      meetingPoint: dto.meetingPoint.trim(),
      included,
      excluded: [] as string[],
      cancellationPolicy: 'A request does not reserve seats until an administrator confirms it. No payment is collected in the app.',
      pricePerPerson: dto.pricePerPerson,
      contactPhone: dto.contactPhone?.trim() || null,
      published: dto.published ?? true,
      searchText: [dto.title, dto.summary, destination.name].join(' ').toLowerCase(),
    };
    if (!id) {
      const created = await this.prisma.tour.create({
        data: {
          ...shared,
          ...media,
          slug: await this.freeSlug(dto.title),
          destination: { connect: { id: destination.id } },
          owner: { connect: { id: userId } },
        },
      });
      await this.audit(userId, 'TOUR_CREATE', created.id);
      return { data: { id: created.id, slug: created.slug } };
    }
    await this.owned(userId, id);
    const saved = await this.prisma.tour.update({
      where: { id },
      data: {
        ...shared,
        ...media,
        destination: { connect: { id: destination.id } },
        ...(media ? { images: { deleteMany: {}, create: media.images.create } } : {}),
      },
    });
    await this.audit(userId, 'TOUR_UPDATE', id);
    return { data: { id: saved.id, slug: saved.slug } };
  }

  async ownerRemove(userId: string, id: string) {
    await this.owned(userId, id);
    const bookings = await this.prisma.booking.count({ where: { tourId: id } });
    if (bookings) {
      await this.prisma.tour.update({ where: { id }, data: { published: false } });
      return { data: { ok: true, hidden: true } };
    }
    await this.prisma.tour.delete({ where: { id } });
    await this.audit(userId, 'TOUR_DELETE', id);
    return { data: { ok: true, hidden: false } };
  }

  async ownerRemoveVideo(userId: string, id: string) {
    const result = await this.prisma.travelVideo.deleteMany({ where: { id, creatorId: userId } });
    if (!result.count) throw new NotFoundException({ message: 'Video was not found.', code: 'NOT_FOUND' });
    return { data: { ok: true } };
  }

  private mediaOf(dto: OwnerTourDto) {
    if (dto.coverImageUrl === undefined && dto.imageUrls === undefined) return undefined;
    const urls = [dto.coverImageUrl, ...(dto.imageUrls ?? [])].map((item) => item?.trim() ?? '').filter(Boolean);
    const unique = [...new Set(urls)].slice(0, 8);
    if (unique.some((url) => !STORED_IMAGE.test(url))) {
      throw new BadRequestException({ message: 'Upload the photo in the app first.', code: 'UPLOAD' });
    }
    const cover = dto.coverImageUrl?.trim() || unique[0] || null;
    return {
      coverImageUrl: cover,
      images: {
        create: unique.map((url, index) => ({ url, alt: dto.title.trim(), sortOrder: index })),
      },
    };
  }

  private async owned(userId: string, id: string) {
    const row = await this.prisma.tour.findFirst({ where: { id, ownerId: userId } });
    if (!row) throw new ForbiddenException({ message: 'This tour is not yours.', code: 'FORBIDDEN' });
    return row;
  }

  private async freeSlug(title: string) {
    const base = slugify(title) || 'tour';
    const taken = await this.prisma.tour.findUnique({ where: { slug: base } });
    return taken ? `${base}-${Date.now().toString(36)}` : base;
  }

  async remove(id: string, actorId: string) {
    const bookings = await this.prisma.booking.count({ where: { tourId: id } });
    if (bookings) {
      throw new BadRequestException({
        message: 'This tour has bookings. Close its dates or unpublish it instead of deleting it.',
        code: 'CONFLICT',
      });
    }
    await this.prisma.tour.delete({ where: { id } });
    await this.audit(actorId, 'TOUR_DELETE', id);
    return { data: { ok: true } };
  }

  async addDate(tourId: string, dto: TourDateDto, actorId: string) {
    if (dto.endDate < dto.startDate) {
      throw new BadRequestException({ message: 'The end date is before the start date.', code: 'DATE' });
    }
    const date = await this.prisma.tourDate.create({
      data: {
        tourId,
        startDate: new Date(`${dto.startDate}T00:00:00.000Z`),
        endDate: new Date(`${dto.endDate}T00:00:00.000Z`),
        capacity: dto.capacity,
        status: dto.status ?? DateStatus.OPEN,
      },
    });
    await this.audit(actorId, 'TOUR_DATE_CREATE', date.id);
    return { data: { id: date.id } };
  }

  async updateDate(id: string, dto: TourDateDto, actorId: string) {
    const current = await this.prisma.tourDate.findUnique({ where: { id } });
    if (!current) throw new NotFoundException({ message: 'Date was not found.', code: 'NOT_FOUND' });
    if (dto.capacity < current.bookedSeats) {
      throw new BadRequestException({
        message: 'Capacity cannot be lower than seats already requested.',
        code: 'CAPACITY',
      });
    }
    await this.prisma.tourDate.update({
      where: { id },
      data: {
        startDate: new Date(`${dto.startDate}T00:00:00.000Z`),
        endDate: new Date(`${dto.endDate}T00:00:00.000Z`),
        capacity: dto.capacity,
        status: dto.status ?? current.status,
      },
    });
    await this.audit(actorId, 'TOUR_DATE_UPDATE', id);
    return { data: { id } };
  }

  private data(dto: UpsertTourDto, slug: string): Prisma.TourCreateInput {
    const searchText = [dto.title, dto.category, dto.difficulty, JSON.stringify(dto.copy)].join(' ').toLowerCase();
    return {
      slug,
      title: dto.title.trim(),
      copy: dto.copy as unknown as Prisma.InputJsonValue,
      category: dto.category,
      difficulty: dto.difficulty,
      durationDays: dto.durationDays,
      meetingPoint: dto.meetingPoint,
      included: dto.included,
      excluded: dto.excluded,
      cancellationPolicy: dto.cancellationPolicy,
      pricePerPerson: dto.pricePerPerson,
      published: dto.published ?? false,
      coverImageUrl: dto.coverImageUrl ?? dto.images?.[0]?.url,
      searchText,
      destination: { connect: { id: dto.destinationId } },
      guide: dto.guideId ? { connect: { id: dto.guideId } } : undefined,
      images: {
        create: (dto.images ?? []).map((image, index) => ({
          url: image.url,
          alt: image.alt,
          credit: image.credit,
          sortOrder: index,
        })),
      },
    };
  }

  private audit(actorId: string, action: string, entityId: string) {
    return this.prisma.auditLog.create({ data: { actorId, action, entity: 'Tour', entityId } });
  }
}
