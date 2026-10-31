import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BookingStatus, Role } from '../generated/prisma/client';
import { CurrentUser } from '../auth/current-user';
import { Roles } from '../auth/guards';
import { AuthUser } from '../auth/jwt.strategy';
import { BookingStatusDto, CreateBookingDto } from './bookings.dto';
import { BookingsService } from './bookings.service';

@ApiTags('bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBookingDto) {
    return this.bookings.create(user, dto);
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.bookings.mine(user.id);
  }

  @Roles(Role.ADMIN)
  @Get('manage')
  manage(@Query('status') status?: string) {
    return this.bookings.adminList(status);
  }

  @Get(':id')
  one(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.bookings.one(user, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.bookings.setStatus(user, id, BookingStatus.CANCELLED);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/status')
  status(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: BookingStatusDto) {
    return this.bookings.setStatus(user, id, dto.status as BookingStatus);
  }
}
