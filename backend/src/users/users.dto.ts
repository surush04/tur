import { IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  bio?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredRegions?: string[];

  @IsOptional()
  @IsIn(['en', 'ru', 'tg'])
  language?: string;

  @IsOptional()
  @IsBoolean()
  showProfilePublicly?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyBookings?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyCompanions?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyMarketing?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  telegramHandle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  whatsappHandle?: string;
}

export class AccountModeDto {
  @IsIn(['traveler', 'owner'])
  mode!: 'traveler' | 'owner';
}
