import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OptionalJwtGuard } from '../auth/optional-jwt.guard';
import { CompanionsController } from './companions.controller';

@Module({
  imports: [AuthModule],
  controllers: [CompanionsController],
  providers: [OptionalJwtGuard],
})
export class CompanionsModule {}
