import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { ChangePasswordDto, ForgotDto, LoginDto, RefreshDto, RegisterDto, ResetDto } from './auth.dto';
import { CurrentUser } from './current-user';
import { Public } from './guards';
import { AuthUser } from './jwt.strategy';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @Post('register')
  register(@Body() dto: RegisterDto, @Headers('user-agent') userAgent?: string) {
    return this.auth.register(dto, userAgent);
  }

  @Public()
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @Post('login')
  login(@Body() dto: LoginDto, @Headers('user-agent') userAgent?: string) {
    return this.auth.login(dto.email, dto.password, userAgent);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @Headers('user-agent') userAgent?: string) {
    return this.auth.refresh(dto.refreshToken, userAgent);
  }

  @Public()
  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('forgot')
  forgot(@Body() dto: ForgotDto) {
    return this.auth.forgot(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @Post('reset')
  reset(@Body() dto: ResetDto) {
    return this.auth.reset(dto);
  }

  @ApiBearerAuth()
  @Post('change-password')
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user, dto);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
