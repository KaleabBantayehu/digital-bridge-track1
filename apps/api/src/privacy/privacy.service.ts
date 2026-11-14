import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { throwBilingualHttp } from "../common/filters/bilingual-exception.filter";
import { OnboardingSessionEntity } from "../onboarding/entities/onboarding-session.entity";
import { SupportPreferenceEntity } from "../onboarding/entities/support-preference.entity";
import { SmsResumeTokenEntity } from "../sms/entities/sms-resume-token.entity";
import { ApplicationEntity } from "../career/entities/application.entity";

@Injectable()
export class PrivacyService {
  constructor(
    @InjectRepository(OnboardingSessionEntity) private readonly sessions: Repository<OnboardingSessionEntity>,
    @InjectRepository(SupportPreferenceEntity) private readonly support: Repository<SupportPreferenceEntity>,
    @InjectRepository(SmsResumeTokenEntity) private readonly tokens: Repository<SmsResumeTokenEntity>,
    @InjectRepository(ApplicationEntity) private readonly applications: Repository<ApplicationEntity>,
  ) {}

  async export(sessionId: string) {
    const session = await this.sessions.findOne({ where: { id: sessionId } });
    if (!session) throwBilingualHttp(HttpStatus.NOT_FOUND, undefined, "NotFound");
    return {
      session,
      supportPreferences: await this.support.findOne({ where: { sessionId } }),
      applications: await this.applications.find({ where: { applicantProfileId: sessionId } }),
    };
  }

  async remove(sessionId: string) {
    const session = await this.sessions.findOne({ where: { id: sessionId } });
    if (!session) throwBilingualHttp(HttpStatus.NOT_FOUND, undefined, "NotFound");
    await this.applications.delete({ applicantProfileId: sessionId });
    await this.tokens.delete({ sessionId });
    await this.support.delete({ sessionId });
    await this.sessions.delete({ id: sessionId });
  }
}
