import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const PIN = /^\d{4}$/;

export class RegisterDto {
  @IsEmail()
  @MaxLength(180)
  email!: string;

  @IsString()
  @Matches(PIN, { message: 'Use a 4-digit code.' })
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName!: string;

  @IsOptional()
  @IsIn(['en', 'ru', 'tg'])
  language?: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(200)
  password!: string;
}

export class RefreshDto {
  @IsString()
  @MinLength(20)
  refreshToken!: string;
}

export class ForgotDto {
  @IsEmail()
  email!: string;
}

export class ResetDto {
  @IsString()
  @MinLength(20)
  token!: string;

  @IsString()
  @Matches(PIN, { message: 'Use a 4-digit code.' })
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(4)
  @MaxLength(200)
  currentPassword!: string;

  @IsString()
  @Matches(PIN, { message: 'Use a 4-digit code.' })
  newPassword!: string;
}
