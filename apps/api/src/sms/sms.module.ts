import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OnboardingModule } from "../onboarding/onboarding.module";
import { SmsController } from "./sms.controller";
import { SmsService } from "./sms.service";
import { SmsResumeTokenEntity } from "./entities/sms-resume-token.entity";

@Module({
  imports: [TypeOrmModule.forFeature([SmsResumeTokenEntity]), OnboardingModule],
  controllers: [SmsController],
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
