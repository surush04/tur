import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { decToString } from '../common/money';
import { AppLang, localize, pageArgs, slugify } from '../common/lang';
import { PrismaService } from '../prisma/prisma.service';
import { DestinationQueryDto, UpsertDestinationDto } from './catalog.dto';
import { combineRatings, tourRatings } from './ratings';

type DestinationRecord = Prisma.DestinationGetPayload<{ include: { images: true; tours: true } }>;

@Injectable()
export class DestinationsService {
  constructor(private readonly prisma: PrismaService) {}

  private card(row: DestinationRecord, lang: AppLang, rating: { rating: number | null; ratingCount: number }) {
    const copy = localize(row.copy, lang);
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      region: row.region,
      category: row.category,
      summary: copy.summary,
      description: copy.description,
      tips: copy.tips ?? null,
      latitude: decToString(row.latitude),
      longitude: decToString(row.longitude),
      locationNote: row.locationNote,
      suggestedDays: row.suggestedDays,
      bestPeriod: row.bestPeriod,
      budgetEstimateMin: decToString(row.budgetEstimateMin),
      budgetEstimateMax: decToString(row.budgetEstimateMax),
      budgetNote: row.budgetNote,
      activities: row.activities,
      coverImageUrl: row.coverImageUrl,
      images: row.images
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((image) => ({ url: image.url, alt: image.alt, credit: image.credit })),
      featured: row.featured,
      trending: row.trending,
      weekend: row.weekend,
      budgetFriendly: row.budgetFriendly,
      published: row.published,
      rating: rating.rating,
      ratingCount: rating.ratingCount,
      tourCount: row.tours.filter((tour) => tour.published).length,
    };
  }

  private async withRatings(rows: DestinationRecord[], lang: AppLang) {
    const tourIds = rows.flatMap((row) => row.tours.map((tour) => tour.id));
    const ratings = await tourRatings(this.prisma, tourIds);
    return rows.map((row) => {
      const parts = row.tours.map((tour) => ratings.get(tour.id) ?? { rating: null, ratingCount: 0 });
      return this.card(row, lang, combineRatings(parts));
    });
  }

  async list(query: DestinationQueryDto, lang: AppLang, includeUnpublished = false) {
    const page = pageArgs(query.page, query.pageSize);
    const where: Prisma.DestinationWhereInput = {
      published: includeUnpublished ? undefined : true,
      region: query.region,
      category: query.category,
      weekend: query.weekend || undefined,
      budgetFriendly: query.budget || undefined,
      trending: query.trending || undefined,
      searchText: query.q ? { contains: query.q.toLowerCase() } : undefined,
    };
    const [rows, total] = await Promise.all([
      this.prisma.destination.findMany({
        where,
        include: { images: true, tours: true },
        skip: page.skip,
        take: page.take,
        orderBy: query.sort === 'name' ? { name: 'asc' } : [{ featured: 'desc' }, { name: 'asc' }],
      }),
      this.prisma.destination.count({ where }),
    ]);
    let data = await this.withRatings(rows, lang);
    if (query.sort === 'rating') {
      data = [...data].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    }
    return { data, meta: { page: page.page, pageSize: page.pageSize, total } };
  }

  async home(lang: AppLang) {
    const rows = await this.prisma.destination.findMany({
      where: { published: true },
      include: { images: true, tours: true },
      orderBy: { name: 'asc' },
    });
    const cards = await this.withRatings(rows, lang);
    const tours = await this.prisma.tour.findMany({
      where: { published: true },
      include: { destination: true, images: true },
      take: 8,
      orderBy: { pricePerPerson: 'asc' },
    });
    const ratings = await tourRatings(this.prisma, tours.map((tour) => tour.id));
    const guides = await this.prisma.guideProfile.findMany({
      where: { status: 'PUBLISHED' },
      take: 6,
      orderBy: { displayName: 'asc' },
    });
    const stays = await this.prisma.accommodation.findMany({
      where: { status: 'PUBLISHED' },
      take: 6,
      orderBy: { name: 'asc' },
    });
    return {
      data: {
        popular: cards.filter((card) => card.featured).slice(0, 8),
        trending: cards.filter((card) => card.trending).slice(0, 8),
        weekend: cards.filter((card) => card.weekend).slice(0, 8),
        budget: cards.filter((card) => card.budgetFriendly).slice(0, 8),
        categories: ['LAKES', 'MOUNTAINS', 'CITIES', 'CULTURE', 'ROAD', 'NATURE'],
        tours: tours.map((tour) => ({
          id: tour.id,
          slug: tour.slug,
          title: localize(tour.copy, lang).title ?? tour.title,
          summary: localize(tour.copy, lang).summary,
          destinationName: tour.destination.name,
          destinationSlug: tour.destination.slug,
          region: tour.destination.region,
          category: tour.category,
          difficulty: tour.difficulty,
          durationDays: tour.durationDays,
          pricePerPerson: decToString(tour.pricePerPerson),
          currency: tour.currency,
          coverImageUrl: tour.coverImageUrl ?? tour.destination.coverImageUrl,
          ...(ratings.get(tour.id) ?? { rating: null, ratingCount: 0 }),
        })),
        guides: guides.map((guide) => ({
          id: guide.id,
          displayName: guide.displayName,
          region: guide.region,
          kind: guide.kind,
          specialties: guide.specialties,
          coverImageUrl: guide.coverImageUrl,
          verified: false,
        })),
        accommodations: stays.map((stay) => ({
          id: stay.id,
          slug: stay.slug,
          name: stay.name,
          type: stay.type,
          region: stay.region,
          summary: localize(stay.copy, lang).summary,
          priceRangeMin: decToString(stay.priceRangeMin),
          priceRangeMax: decToString(stay.priceRangeMax),
          coverImageUrl: stay.coverImageUrl,
          verified: false,
        })),
      },
    };
  }

  async bySlug(slug: string, lang: AppLang) {
    const row = await this.prisma.destination.findFirst({
      where: { slug, published: true },
      include: {
        images: true,
        tours: { where: { published: true }, include: { images: true, guide: true } },
        accommodations: { where: { status: 'PUBLISHED' } },
      },
    });
    if (!row) throw new NotFoundException({ message: 'Destination was not found.', code: 'NOT_FOUND' });
    const [card] = await this.withRatings([row], lang);
    const ratings = await tourRatings(
      this.prisma,
      row.tours.map((tour) => tour.id),
    );
    return {
      data: {
        ...card,
        tours: row.tours.map((tour) => ({
          id: tour.id,
          slug: tour.slug,
          title: localize(tour.copy, lang).title ?? tour.title,
          summary: localize(tour.copy, lang).summary,
          pricePerPerson: decToString(tour.pricePerPerson),
          currency: tour.currency,
          durationDays: tour.durationDays,
          difficulty: tour.difficulty,
          coverImageUrl: tour.coverImageUrl,
          ...(ratings.get(tour.id) ?? { rating: null, ratingCount: 0 }),
        })),
        accommodations: row.accommodations.map((stay) => ({
          id: stay.id,
          slug: stay.slug,
          name: stay.name,
          type: stay.type,
          summary: localize(stay.copy, lang).summary,
          priceRangeMin: decToString(stay.priceRangeMin),
          priceRangeMax: decToString(stay.priceRangeMax),
          coverImageUrl: stay.coverImageUrl,
          verified: false,
        })),
      },
    };
  }

  async mapPoints() {
    const [destinations, stays, tours] = await Promise.all([
      this.prisma.destination.findMany({
        where: { published: true },
        select: {
          id: true,
          slug: true,
          name: true,
          region: true,
          category: true,
          latitude: true,
          longitude: true,
          coverImageUrl: true,
          locationNote: true,
        },
      }),
      this.prisma.accommodation.findMany({
        where: { status: 'PUBLISHED', latitude: { not: null }, longitude: { not: null } },
        select: { id: true, slug: true, name: true, region: true, latitude: true, longitude: true, coverImageUrl: true, type: true },
      }),
      this.prisma.tour.findMany({
        where: { published: true },
        select: {
          id: true,
          slug: true,
          title: true,
          coverImageUrl: true,
          destination: { select: { name: true, region: true, latitude: true, longitude: true, coverImageUrl: true } },
        },
      }),
    ]);
    return {
      data: {
        destinations: destinations.map((item) => ({
          ...item,
          latitude: decToString(item.latitude),
          longitude: decToString(item.longitude),
          kind: 'destination',
        })),
        accommodations: stays.map((item) => ({
          ...item,
          latitude: decToString(item.latitude),
          longitude: decToString(item.longitude),
          kind: 'accommodation',
          verified: false,
        })),
        tours: tours.map((item) => ({
          id: item.id,
          slug: item.slug,
          name: item.title,
          region: item.destination.region,
          latitude: decToString(item.destination.latitude),
          longitude: decToString(item.destination.longitude),
          coverImageUrl: item.coverImageUrl ?? item.destination.coverImageUrl,
          kind: 'tour',
          placeName: item.destination.name,
        })),
      },
    };
  }

  async create(dto: UpsertDestinationDto, actorId: string) {
    const slug = dto.slug?.trim() || slugify(dto.name);
    const created = await this.prisma.destination.create({
      data: this.data(dto, slug),
    });
    await this.audit(actorId, 'DESTINATION_CREATE', created.id);
    return { data: { id: created.id, slug: created.slug } };
  }

  async update(id: string, dto: UpsertDestinationDto, actorId: string) {
    const slug = dto.slug?.trim() || slugify(dto.name);
    const data = this.data(dto, slug);
    if (dto.images) {
      await this.prisma.destinationImage.deleteMany({ where: { destinationId: id } });
    } else {
      delete data.images;
    }
    await this.prisma.destination.update({ where: { id }, data });
    await this.audit(actorId, 'DESTINATION_UPDATE', id);
    return { data: { id, slug } };
  }

  async remove(id: string, actorId: string) {
    const bookings = await this.prisma.booking.count({ where: { tour: { destinationId: id } } });
    if (bookings > 0) {
      throw new BadRequestException({
        message: 'This destination still has bookings. Unpublish it instead of deleting it.',
        code: 'CONFLICT',
      });
    }
    await this.prisma.destination.delete({ where: { id } });
    await this.audit(actorId, 'DESTINATION_DELETE', id);
    return { data: { ok: true } };
  }

  private data(dto: UpsertDestinationDto, slug: string): Prisma.DestinationCreateInput {
    const searchText = [dto.name, dto.region, dto.category, ...dto.activities, JSON.stringify(dto.copy)]
      .join(' ')
      .toLowerCase();
    return {
      slug,
      name: dto.name.trim(),
      region: dto.region,
      category: dto.category,
      copy: dto.copy as unknown as Prisma.InputJsonValue,
      latitude: dto.latitude,
      longitude: dto.longitude,
      suggestedDays: dto.suggestedDays,
      bestPeriod: dto.bestPeriod ?? null,
      budgetEstimateMin: dto.budgetEstimateMin,
      budgetEstimateMax: dto.budgetEstimateMax,
      budgetNote: dto.budgetNote ?? 'Catalog estimate only. Confirm costs locally. This is not a live price.',
      activities: dto.activities,
      searchText,
      published: dto.published ?? false,
      featured: dto.featured ?? false,
      trending: dto.trending ?? false,
      weekend: dto.weekend ?? false,
      budgetFriendly: dto.budgetFriendly ?? false,
      coverImageUrl: dto.coverImageUrl ?? dto.images?.[0]?.url,
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
    return this.prisma.auditLog.create({
      data: { actorId, action, entity: 'Destination', entityId },
    });
  }
}
