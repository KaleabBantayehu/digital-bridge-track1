import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OnboardingController } from "./onboarding.controller";
import { OnboardingService } from "./onboarding.service";
import { OnboardingSessionEntity } from "./entities/onboarding-session.entity";
import { SupportPreferenceEntity } from "./entities/support-preference.entity";

@Module({
  imports: [TypeOrmModule.forFeature([OnboardingSessionEntity, SupportPreferenceEntity])],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
