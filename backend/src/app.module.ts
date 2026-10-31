import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard, RolesGuard } from './auth/guards';
import { BookingsModule } from './bookings/bookings.module';
import { CompanionsModule } from './companions/companions.module';
import { DestinationsModule } from './catalog/destinations.module';
import { ToursModule } from './catalog/tours.module';
import { FavoritesModule } from './favorites/favorites.module';
import { ItinerariesModule } from './itineraries/itineraries.module';
import { AccommodationsModule, GuidesModule, ListingsModule } from './listings/listings.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SocialModule } from './social/social.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 180 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    DestinationsModule,
    ToursModule,
    BookingsModule,
    FavoritesModule,
    ItinerariesModule,
    AiModule,
    AccommodationsModule,
    GuidesModule,
    ListingsModule,
    CompanionsModule,
    ReviewsModule,
    SocialModule,
    NotificationsModule,
    AdminModule,
    UploadsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
