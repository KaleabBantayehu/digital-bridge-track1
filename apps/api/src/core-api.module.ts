import { Controller, Get, Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import * as fs from "fs";
import * as path from "path";
import { BilingualExceptionFilter } from "./common/filters/bilingual-exception.filter";
import { ApplicationEntity } from "./career/entities/application.entity";
import { JobEntity } from "./career/entities/job.entity";
import { CareerModule } from "./career/career.module";
import { OnboardingSessionEntity } from "./onboarding/entities/onboarding-session.entity";
import { SupportPreferenceEntity } from "./onboarding/entities/support-preference.entity";
import { OnboardingModule } from "./onboarding/onboarding.module";
import { PrivacyModule } from "./privacy/privacy.module";
import { SmsResumeTokenEntity } from "./sms/entities/sms-resume-token.entity";
import { SmsModule } from "./sms/sms.module";
import { SeedModule } from "./seed/seed.module";
import { PartnerVoucherEntity } from "./vouch/entities/partner-voucher.entity";
import { VouchModule } from "./vouch/vouch.module";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

@Controller("health")
class HealthController {
  @Get()
  check() {
    return { status: "ok", version: "v1" };
  }
}

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: "sqljs",
      location: path.join(dataDir, "digital_bridge.sqlite"),
      autoSave: true,
      synchronize: true,
      entities: [
        OnboardingSessionEntity,
        SupportPreferenceEntity,
        SmsResumeTokenEntity,
        PartnerVoucherEntity,
        JobEntity,
        ApplicationEntity,
      ],
    }),
    OnboardingModule,
    SmsModule,
    VouchModule,
    CareerModule,
    PrivacyModule,
    SeedModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: BilingualExceptionFilter }],
})
export class CoreApiModule {}
