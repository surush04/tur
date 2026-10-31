import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class TravelerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;
}

export class CreateBookingDto {
  @IsUUID()
  tourDateId!: string;

  @IsInt()
  @Min(1)
  @Max(20)
  travelers!: number;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  contactName!: string;

  @IsEmail()
  contactEmail!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(30)
  contactPhone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TravelerDto)
  travelerNames!: TravelerDto[];
}

export class BookingStatusDto {
  @IsIn(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'])
  status!: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
}
