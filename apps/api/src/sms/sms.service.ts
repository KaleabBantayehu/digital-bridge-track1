import { Injectable, HttpStatus } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { randomBytes } from "crypto";
import { normaliseEtPhone } from "@db/shared-schemas";
import { SmsResumeTokenEntity } from "./entities/sms-resume-token.entity";
import { OnboardingService } from "../onboarding/onboarding.service";
import { throwBilingualHttp, throwFieldValidation } from "../common/filters/bilingual-exception.filter";

@Injectable()
export class SmsService {
  constructor(
    @InjectRepository(SmsResumeTokenEntity)
    private readonly tokenRepo: Repository<SmsResumeTokenEntity>,
    private readonly onboardingService: OnboardingService
  ) {}

  async createResumeLink(sessionId: string, rawPhone: string) {
    await this.onboardingService.getSession(sessionId);
    const phone = normaliseEtPhone(String(rawPhone || ""));
    if (!phone) {
      throwFieldValidation("phone", "INVALID_ET_PHONE");
    }

    const token = randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await this.tokenRepo.save({
      token,
      sessionId,
      phone,
      expiresAt,
      used: false,
    });

    const devLink = `http://localhost:5173/?resumeToken=${token}`;
    return {
      sent: true,
      expiresAt,
      devLink,
    };
  }

  async consumeResumeToken(token: string) {
    const record = await this.tokenRepo.findOne({ where: { token } });
    if (!record || record.used || new Date(record.expiresAt).getTime() < Date.now()) {
      throwBilingualHttp(
        HttpStatus.GONE,
        record?.used ? "TOKEN_USED" : "TOKEN_EXPIRED",
        "NotFound",
      );
    }
    record.used = true;
    await this.tokenRepo.save(record);
    return this.onboardingService.getSession(record.sessionId, true);
  }
}
