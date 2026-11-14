import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ApplicationEntity } from "../career/entities/application.entity";
import { OnboardingSessionEntity } from "../onboarding/entities/onboarding-session.entity";
import { SupportPreferenceEntity } from "../onboarding/entities/support-preference.entity";
import { SmsResumeTokenEntity } from "../sms/entities/sms-resume-token.entity";
import { PrivacyController } from "./privacy.controller";
import { PrivacyService } from "./privacy.service";

@Module({
  imports: [TypeOrmModule.forFeature([OnboardingSessionEntity, SupportPreferenceEntity, SmsResumeTokenEntity, ApplicationEntity])],
  controllers: [PrivacyController],
  providers: [PrivacyService],
})
export class PrivacyModule {}
