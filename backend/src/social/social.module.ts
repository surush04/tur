import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OptionalJwtGuard } from '../auth/optional-jwt.guard';
import { SocialController } from './social.controller';

@Module({
  imports: [AuthModule],
  controllers: [SocialController],
  providers: [OptionalJwtGuard],
})
export class SocialModule {}
