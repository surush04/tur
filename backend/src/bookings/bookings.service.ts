import { randomBytes } from 'crypto';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, Prisma, Role } from '../generated/prisma/client';
import { assertBookable, canTransition, quoteTotal, releasesSeats } from '../common/booking-rules';
import { decToString } from '../common/money';
import { todayUtc } from '../common/lang';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/jwt.strategy';
import { CreateBookingDto } from './bookings.dto';

interface LockedDate {
  id: string;
  tourId: string;
  capacity: number;
  bookedSeats: number;
  status: string;
  startDate: Date;
}

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: AuthUser, dto: CreateBookingDto) {
    if (dto.travelerNames.length !== dto.travelers) {
      throw new BadRequestException({
        message: 'Enter one name for each traveler.',
        code: 'TRAVELERS',
      });
    }
    const reference = `RH-${randomBytes(4).toString('hex').toUpperCase()}`;
    const booking = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<LockedDate[]>`
        SELECT id, "tourId", capacity, "bookedSeats", CAST(status AS text) as status, "startDate"
        FROM "TourDate"
        WHERE id = ${dto.tourDateId}
        FOR UPDATE
      `;
      const date = locked[0];
      if (!date) {
        throw new NotFoundException({ message: 'That departure was not found.', code: 'NOT_FOUND' });
      }
      date.capacity = Number(date.capacity);
      date.bookedSeats = Number(date.bookedSeats);
      const tour = await tx.tour.findUnique({
        where: { id: date.tourId },
        include: { destination: true },
      });
      if (!tour) throw new NotFoundException({ message: 'Tour was not found.', code: 'NOT_FOUND' });
      const problem = assertBookable({
        published: tour.published,
        status: date.status,
        capacity: date.capacity,
        bookedSeats: date.bookedSeats,
        travelers: dto.travelers,
        startDate: new Date(date.startDate).toISOString().slice(0, 10),
        today: todayUtc(),
      });
      if (problem) {
        throw new BadRequestException({
          message: problem === 'CAPACITY' ? 'Not enough seats remain for this date.' : 'This departure cannot be requested.',
          code: problem,
        });
      }
      const unit = decToString(tour.pricePerPerson) ?? '0.00';
      const total = quoteTotal(unit, dto.travelers);
      await tx.tourDate.update({
        where: { id: date.id },
        data: { bookedSeats: { increment: dto.travelers } },
      });
      return tx.booking.create({
        data: {
          reference,
          userId: user.id,
          tourId: tour.id,
          tourDateId: date.id,
          travelers: dto.travelers,
          pricePerPerson: unit,
          totalPrice: total,
          currency: tour.currency,
          status: BookingStatus.PENDING,
          contactName: dto.contactName.trim(),
          contactEmail: dto.contactEmail.toLowerCase(),
          contactPhone: dto.contactPhone.trim(),
          notes: dto.notes?.trim(),
          paymentStatus: 'NOT_COLLECTED',
          travelersList: { create: dto.travelerNames.map((traveler) => ({ fullName: traveler.fullName.trim() })) },
        },
        include: { tour: { include: { destination: true } }, tourDate: true, travelersList: true },
      });
    });
    if (user) {
      const prefs = await this.prisma.user.findUnique({ where: { id: user.id } });
      if (prefs?.notifyBookings) {
        await this.prisma.notification.create({
          data: {
            userId: user.id,
            type: 'BOOKING',
            title: 'Booking request received',
            body: `${booking.reference} is pending confirmation. No payment has been taken.`,
          },
        });
      }
    }
    await this.prisma.auditLog.create({
      data: { actorId: user.id, action: 'BOOKING_CREATE', entity: 'Booking', entityId: booking.id },
    });
    return { data: this.present(booking) };
  }

  async mine(userId: string) {
    const rows = await this.prisma.booking.findMany({
      where: { userId },
      include: { tour: { include: { destination: true } }, tourDate: true, travelersList: true },
      orderBy: { createdAt: 'desc' },
    });
    return { data: rows.map((row) => this.present(row)) };
  }

  async one(user: AuthUser, id: string) {
    const row = await this.prisma.booking.findUnique({
      where: { id },
      include: { tour: { include: { destination: true } }, tourDate: true, travelersList: true },
    });
    if (!row) throw new NotFoundException({ message: 'Booking was not found.', code: 'NOT_FOUND' });
    if (row.userId !== user.id && user.role !== Role.ADMIN) {
      throw new ForbiddenException({ message: 'You can only open your own bookings.', code: 'FORBIDDEN' });
    }
    return { data: this.present(row) };
  }

  async setStatus(user: AuthUser, id: string, status: BookingStatus) {
    const actor = user.role === Role.ADMIN ? 'ADMIN' : 'USER';
    const updated = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string; status: string; travelers: number; tourDateId: string; userId: string }>>`
        SELECT id, CAST(status AS text) as status, travelers, "tourDateId", "userId"
        FROM "Booking"
        WHERE id = ${id}
        FOR UPDATE
      `;
      const current = rows[0];
      if (!current) throw new NotFoundException({ message: 'Booking was not found.', code: 'NOT_FOUND' });
      current.travelers = Number(current.travelers);
      if (current.userId !== user.id && user.role !== Role.ADMIN) {
        throw new ForbiddenException({ message: 'You can only change your own bookings.', code: 'FORBIDDEN' });
      }
      if (!canTransition(current.status, status, actor)) {
        throw new BadRequestException({ message: 'That status change is not allowed.', code: 'STATUS' });
      }
      if (releasesSeats(current.status, status)) {
        await tx.$executeRaw`
          UPDATE "TourDate"
          SET "bookedSeats" = "bookedSeats" - ${current.travelers}
          WHERE id = ${current.tourDateId}
            AND "bookedSeats" >= ${current.travelers}
        `;
      }
      return tx.booking.update({
        where: { id },
        data: { status },
        include: { tour: { include: { destination: true } }, tourDate: true, travelersList: true },
      });
    });
    const owner = await this.prisma.user.findUnique({ where: { id: updated.userId } });
    if (owner?.notifyBookings) {
      await this.prisma.notification.create({
        data: {
          userId: owner.id,
          type: 'BOOKING',
          title: `Booking ${updated.status.toLowerCase()}`,
          body: `${updated.reference} is now ${updated.status}. Payment status: ${updated.paymentStatus}.`,
        },
      });
    }
    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'BOOKING_STATUS',
        entity: 'Booking',
        entityId: id,
        metadata: { status } as Prisma.InputJsonValue,
      },
    });
    return { data: this.present(updated) };
  }

  async adminList(status?: string) {
    const rows = await this.prisma.booking.findMany({
      where: status ? { status: status as BookingStatus } : undefined,
      include: { tour: { include: { destination: true } }, tourDate: true, user: true, travelersList: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return {
      data: rows.map((row) => ({
        ...this.present(row),
        userEmail: row.user.email,
        userName: `${row.user.firstName} ${row.user.lastName}`,
      })),
    };
  }

  private present(row: {
    id: string;
    reference: string;
    status: BookingStatus;
    travelers: number;
    pricePerPerson: Prisma.Decimal;
    totalPrice: Prisma.Decimal;
    currency: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    notes: string | null;
    paymentStatus: string;
    createdAt: Date;
    tour: { slug: string; title: string; coverImageUrl: string | null; destination: { name: string; slug: string } };
    tourDate: { startDate: Date; endDate: Date };
    travelersList: { fullName: string }[];
  }) {
    return {
      id: row.id,
      reference: row.reference,
      status: row.status,
      travelers: row.travelers,
      pricePerPerson: decToString(row.pricePerPerson),
      totalPrice: decToString(row.totalPrice),
      currency: row.currency,
      contactName: row.contactName,
      contactEmail: row.contactEmail,
      contactPhone: row.contactPhone,
      notes: row.notes,
      paymentStatus: row.paymentStatus,
      paymentNote: 'No online payment is configured. This record is a request, not a paid order.',
      createdAt: row.createdAt.toISOString(),
      startDate: row.tourDate.startDate.toISOString().slice(0, 10),
      endDate: row.tourDate.endDate.toISOString().slice(0, 10),
      tour: {
        slug: row.tour.slug,
        title: row.tour.title,
        coverImageUrl: row.tour.coverImageUrl,
        destinationName: row.tour.destination.name,
        destinationSlug: row.tour.destination.slug,
      },
      travelerNames: row.travelersList.map((traveler) => traveler.fullName),
    };
  }
}
