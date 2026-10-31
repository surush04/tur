import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OptionalJwtGuard } from '../auth/optional-jwt.guard';
import { AccommodationsController, GuidesController, ProviderListingsController } from './listings.controller';

@Module({
  imports: [AuthModule],
  controllers: [AccommodationsController],
  providers: [OptionalJwtGuard],
})
export class AccommodationsModule {}

@Module({
  imports: [AuthModule],
  controllers: [GuidesController],
  providers: [OptionalJwtGuard],
})
export class GuidesModule {}

@Module({
  controllers: [ProviderListingsController],
})
export class ListingsModule {}
