import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../generated/prisma/client';
import { requestLang } from '../common/lang';
import { CurrentUser } from '../auth/current-user';
import { Public, Roles } from '../auth/guards';
import { AuthUser } from '../auth/jwt.strategy';
import { DestinationQueryDto, UpsertDestinationDto } from './catalog.dto';
import { DestinationsService } from './destinations.service';

@ApiTags('destinations')
@Controller('destinations')
export class DestinationsController {
  constructor(private readonly destinations: DestinationsService) {}

  @Public()
  @Get('home')
  home(@Headers('accept-language') lang?: string) {
    return this.destinations.home(requestLang(lang));
  }

  @Public()
  @Get('map')
  map() {
    return this.destinations.mapPoints();
  }

  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Get('manage')
  manage(@Query() query: DestinationQueryDto, @Headers('accept-language') lang?: string) {
    return this.destinations.list(query, requestLang(lang), true);
  }

  @Public()
  @Get()
  list(@Query() query: DestinationQueryDto, @Headers('accept-language') lang?: string) {
    return this.destinations.list(query, requestLang(lang));
  }

  @Public()
  @Get(':slug')
  one(@Param('slug') slug: string, @Headers('accept-language') lang?: string) {
    return this.destinations.bySlug(slug, requestLang(lang));
  }

  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Post()
  create(@Body() dto: UpsertDestinationDto, @CurrentUser() user: AuthUser) {
    return this.destinations.create(dto, user.id);
  }

  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpsertDestinationDto, @CurrentUser() user: AuthUser) {
    return this.destinations.update(id, dto, user.id);
  }

  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.destinations.remove(id, user.id);
  }
}
