import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../generated/prisma/client';
import { requestLang } from '../common/lang';
import { CurrentUser } from '../auth/current-user';
import { Public, Roles } from '../auth/guards';
import { OptionalJwtGuard } from '../auth/optional-jwt.guard';
import { AuthUser } from '../auth/jwt.strategy';
import { OwnerTourDto, TourDateDto, TourQueryDto, UpsertTourDto } from './catalog.dto';
import { ToursService } from './tours.service';

@ApiTags('tours')
@Controller('tours')
export class ToursController {
  constructor(private readonly tours: ToursService) {}

  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Get('manage')
  manage(@Query() query: TourQueryDto, @Headers('accept-language') lang?: string) {
    return this.tours.list(query, requestLang(lang), true);
  }

  @Public()
  @Get()
  list(@Query() query: TourQueryDto, @Headers('accept-language') lang?: string) {
    return this.tours.list(query, requestLang(lang));
  }

  @Public()
  @UseGuards(OptionalJwtGuard)
  @Get(':slug')
  one(@Param('slug') slug: string, @Headers('accept-language') lang?: string, @CurrentUser() user?: AuthUser) {
    return this.tours.bySlug(slug, requestLang(lang), user?.id);
  }

  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Post()
  create(@Body() dto: UpsertTourDto, @CurrentUser() user: AuthUser) {
    return this.tours.create(dto, user.id);
  }

  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpsertTourDto, @CurrentUser() user: AuthUser) {
    return this.tours.update(id, dto, user.id);
  }

  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tours.remove(id, user.id);
  }

  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Post(':id/dates')
  addDate(@Param('id') id: string, @Body() dto: TourDateDto, @CurrentUser() user: AuthUser) {
    return this.tours.addDate(id, dto, user.id);
  }
}

@ApiTags('owner')
@ApiBearerAuth()
@Controller('owner')
export class OwnerController {
  constructor(private readonly tours: ToursService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.tours.dashboard(user.id);
  }

  @Get('tours/:id')
  tour(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tours.ownerTour(user.id, id);
  }

  @Post('tours')
  create(@CurrentUser() user: AuthUser, @Body() dto: OwnerTourDto) {
    return this.tours.ownerSave(user.id, dto);
  }

  @Patch('tours/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: OwnerTourDto) {
    return this.tours.ownerSave(user.id, dto, id);
  }

  @Delete('tours/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tours.ownerRemove(user.id, id);
  }

  @Delete('videos/:id')
  removeVideo(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tours.ownerRemoveVideo(user.id, id);
  }
}

@ApiTags('tour-dates')
@Roles(Role.ADMIN)
@ApiBearerAuth()
@Controller('tour-dates')
export class TourDatesController {
  constructor(private readonly tours: ToursService) {}

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: TourDateDto, @CurrentUser() user: AuthUser) {
    return this.tours.updateDate(id, dto, user.id);
  }
}
