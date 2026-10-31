import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PageQueryDto } from '../common/dto';

const MONEY = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;
const REGIONS = ['SUGHD', 'DUSHANBE', 'DRS', 'KHATLON', 'GBAO'];
const CATEGORIES = ['LAKES', 'MOUNTAINS', 'CITIES', 'CULTURE', 'ROAD', 'NATURE'];

export class CopyBlockDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(400)
  summary!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  tips?: string;
}

export class CopyDto {
  @ValidateNested()
  @Type(() => CopyBlockDto)
  en!: CopyBlockDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CopyBlockDto)
  ru?: CopyBlockDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CopyBlockDto)
  tg?: CopyBlockDto;
}

export class ImageDto {
  @IsString()
  @MaxLength(800)
  url!: string;

  @IsString()
  @MaxLength(180)
  alt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  credit?: string;
}

export class DestinationQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(REGIONS)
  region?: string;

  @IsOptional()
  @IsIn(CATEGORIES)
  category?: string;

  @IsOptional()
  @IsIn(['featured', 'name', 'rating'])
  sort?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  weekend?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  budget?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  trending?: boolean;
}

export class UpsertDestinationDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsIn(REGIONS)
  region!: string;

  @IsIn(CATEGORIES)
  category!: string;

  @ValidateNested()
  @Type(() => CopyDto)
  copy!: CopyDto;

  @IsString()
  @Matches(/^-?\d{1,3}(\.\d{1,6})?$/)
  latitude!: string;

  @IsString()
  @Matches(/^-?\d{1,3}(\.\d{1,6})?$/)
  longitude!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  suggestedDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bestPeriod?: string;

  @IsOptional()
  @Matches(MONEY)
  budgetEstimateMin?: string;

  @IsOptional()
  @Matches(MONEY)
  budgetEstimateMax?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  budgetNote?: string;

  @IsArray()
  @IsString({ each: true })
  activities!: string[];

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsBoolean()
  trending?: boolean;

  @IsOptional()
  @IsBoolean()
  weekend?: boolean;

  @IsOptional()
  @IsBoolean()
  budgetFriendly?: boolean;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageDto)
  images?: ImageDto[];
}

export class TourQueryDto extends PageQueryDto {
  @IsOptional()
  @IsString()
  destination?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsIn(['EASY', 'MODERATE', 'CHALLENGING', 'STRENUOUS'])
  difficulty?: string;

  @IsOptional()
  @Matches(MONEY)
  minPrice?: string;

  @IsOptional()
  @Matches(MONEY)
  maxPrice?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  duration?: number;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  groupSize?: number;

  @IsOptional()
  @IsIn(['price_asc', 'price_desc', 'rating'])
  sort?: string;
}

export class TourDateDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  capacity!: number;

  @IsOptional()
  @IsIn(['OPEN', 'CLOSED'])
  status?: 'OPEN' | 'CLOSED';
}

export class UpsertTourDto {
  @IsOptional()
  @IsString()
  slug?: string;

  @IsString()
  destinationId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @ValidateNested()
  @Type(() => CopyDto)
  copy!: CopyDto;

  @IsString()
  @MaxLength(40)
  category!: string;

  @IsIn(['EASY', 'MODERATE', 'CHALLENGING', 'STRENUOUS'])
  difficulty!: 'EASY' | 'MODERATE' | 'CHALLENGING' | 'STRENUOUS';

  @IsInt()
  @Min(1)
  @Max(40)
  durationDays!: number;

  @IsString()
  @MaxLength(240)
  meetingPoint!: string;

  @IsArray()
  @IsString({ each: true })
  included!: string[];

  @IsArray()
  @IsString({ each: true })
  excluded!: string[];

  @IsString()
  @MaxLength(800)
  cancellationPolicy!: string;

  @Matches(MONEY)
  pricePerPerson!: string;

  @IsOptional()
  @IsString()
  guideId?: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageDto)
  images?: ImageDto[];
}

export class OwnerTourDto {
  @IsString()
  destinationId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(400)
  summary!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  description!: string;

  @IsIn(CATEGORIES)
  category!: string;

  @IsIn(['EASY', 'MODERATE', 'CHALLENGING', 'STRENUOUS'])
  difficulty!: 'EASY' | 'MODERATE' | 'CHALLENGING' | 'STRENUOUS';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(40)
  durationDays!: number;

  @IsString()
  @MaxLength(240)
  meetingPoint!: string;

  @IsOptional()
  @IsString()
  @MaxLength(800)
  included?: string;

  @Matches(MONEY)
  pricePerPerson!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  contactPhone?: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  coverImageUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  imageUrls?: string[];
}
