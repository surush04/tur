import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user';
import { AuthUser } from '../auth/jwt.strategy';
import { AccountModeDto, UpdateProfileDto } from './users.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.users.me(user.id);
  }

  @Patch('me')
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.update(user.id, dto);
  }

  @Post('me/mode')
  mode(@CurrentUser() user: AuthUser, @Body() dto: AccountModeDto) {
    return this.users.setMode(user.id, dto);
  }

  @Post('me/deletion-request')
  deletion(@CurrentUser() user: AuthUser) {
    return this.users.requestDeletion(user.id);
  }
}
