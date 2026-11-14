import { Injectable, HttpStatus } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { randomUUID } from "crypto";
import {
  OnboardingProfile,
  Lang,
  normaliseEtPhone,
  daysInEthiopianMonth,
} from "@db/shared-schemas";
import { OnboardingSessionEntity } from "./entities/onboarding-session.entity";
import { SupportPreferenceEntity } from "./entities/support-preference.entity";
import { throwBilingualHttp, throwFieldValidation } from "../common/filters/bilingual-exception.filter";

function ethiopianToGregorianIso(date: { year: number; month: number; day: number }): string {
  const gregorianYear = date.year + 7;
  const month = Math.min(date.month, 12);
  const day = Math.min(date.day, 28);
  return new Date(Date.UTC(gregorianYear, month - 1, day)).toISOString().slice(0, 10);
}

@Injectable()
export class OnboardingService {
  constructor(
    @InjectRepository(OnboardingSessionEntity)
    private readonly sessionRepo: Repository<OnboardingSessionEntity>,
    @InjectRepository(SupportPreferenceEntity)
    private readonly supportRepo: Repository<SupportPreferenceEntity>
  ) {}

  async createSession(lang: Lang = "en", partnerId = "alx-demo"): Promise<OnboardingProfile> {
    const now = new Date().toISOString();
    const id = randomUUID();
    const entity = this.sessionRepo.create({
      id,
      partnerId,
      lang: lang === "am" ? "am" : "en",
      consentJson: {
        saveAnswers: true,
        smsResume: false,
        shareWithEmployers: false,
        givenAt: now,
      },
      nameJson: { givenName: "", familyName: "" },
      contactJson: {},
      progressJson: { currentStep: 0, totalSteps: 6, completedSteps: [] },
      revision: 1,
      updatedAt: now,
    });
    await this.sessionRepo.save(entity);
    return this.toProfile(entity);
  }

  async getSession(id: string, includePrivateSupport = false): Promise<OnboardingProfile> {
    const entity = await this.sessionRepo.findOne({ where: { id } });
    if (!entity) {
      throwBilingualHttp(HttpStatus.NOT_FOUND, undefined, "NotFound");
    }
    const profile = this.toProfile(entity);
    if (includePrivateSupport) {
      const support = await this.supportRepo.findOne({ where: { sessionId: id } });
      if (support) {
        profile.support = support.preferencesJson;
      }
    }
    return profile;
  }

  async patchSession(id: string, body: Record<string, any>): Promise<OnboardingProfile> {
    let entity = await this.sessionRepo.findOne({ where: { id } });
    if (!entity) {
      throwBilingualHttp(HttpStatus.NOT_FOUND, undefined, "NotFound");
    }

    const step = body.step as string | undefined;
    const data = body.data ?? body;

    if (body.lang === "en" || body.lang === "am") {
      entity.lang = body.lang;
    }

    // Validate & apply step-specific or partial profile updates
    if (step === "consent" || data.consent) {
      const c = data.consent ?? data;
      entity.consentJson = {
        ...entity.consentJson,
        saveAnswers: Boolean(c.saveAnswers ?? true),
        smsResume: Boolean(c.smsResume ?? false),
        shareWithEmployers: Boolean(c.shareWithEmployers ?? false),
        givenAt: c.givenAt || new Date().toISOString(),
      };
    }

    if (step === "name" || data.name) {
      const n = data.name ?? data;
      const givenName = String(n.givenName ?? "").trim();
      const familyName = String(n.familyName ?? "").trim();
      if (!givenName) throwFieldValidation("givenName", "REQUIRED");
      if (!familyName) throwFieldValidation("familyName", "REQUIRED");
      entity.nameJson = {
        givenName,
        familyName,
        preferredName: n.preferredName ? String(n.preferredName).trim() : undefined,
      };
    }

    if (step === "contact" || data.contact) {
      const ct = data.contact ?? data;
      let normalisedPhone: string | undefined;
      if (ct.phone !== undefined && String(ct.phone).trim() !== "") {
        const norm = normaliseEtPhone(String(ct.phone));
        if (!norm) {
          throwFieldValidation("phone", "INVALID_ET_PHONE");
        }
        normalisedPhone = norm;
      }
      if (ct.email !== undefined && String(ct.email).trim() !== "") {
        const emailStr = String(ct.email).trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailStr)) {
          throwFieldValidation("email", "INVALID_EMAIL");
        }
      }
      entity.contactJson = {
        phone: normalisedPhone ?? entity.contactJson.phone,
        email: ct.email ? String(ct.email).trim() : entity.contactJson.email,
        viaPartner: Boolean(ct.viaPartner ?? entity.contactJson.viaPartner),
      };
    }

    if (step === "dateOfBirth" || data.dateOfBirth) {
      const dob = data.dateOfBirth ?? data;
      if (dob.calendar === "ethiopian" && dob.ethiopian) {
        const { year, month, day } = dob.ethiopian;
        const maxDays = daysInEthiopianMonth(Number(year), Number(month));
        if (!year || month < 1 || month > 13 || day < 1 || day > maxDays) {
          throwFieldValidation("dateOfBirth", "INVALID_ET_DATE");
        }
        entity.dateOfBirthJson = {
          iso: ethiopianToGregorianIso({ year: Number(year), month: Number(month), day: Number(day) }),
          displayCalendar: "ethiopian",
          ethiopian: { year: Number(year), month: Number(month), day: Number(day) },
        };
      } else {
        const iso = String(dob.iso || dob.gregorianIso || "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
          throwFieldValidation("dateOfBirth", "INVALID_ET_DATE");
        }
        entity.dateOfBirthJson = { iso, displayCalendar: "gregorian" };
      }
    }

    if (step === "identity" || data.identity) {
      const idData = data.identity ?? data;
      entity.identityJson = idData;
    }

    // Support preferences are persisted in the isolated support_preferences table
    if (step === "support" || data.support) {
      const sup = data.support ?? data;
      await this.supportRepo.save({
        sessionId: entity.id,
        preferencesJson: {
          needs: Array.isArray(sup.needs) ? sup.needs : [],
          otherText: sup.otherText ? String(sup.otherText) : undefined,
          tellLearningProvider: Boolean(sup.tellLearningProvider),
        },
        updatedAt: new Date().toISOString(),
      });
    }

    if (data.progress) {
      entity.progressJson = {
        ...entity.progressJson,
        ...data.progress,
      };
    }

    entity.revision += 1;
    entity.updatedAt = new Date().toISOString();
    await this.sessionRepo.save(entity);
    return this.toProfile(entity);
  }

  private toProfile(entity: OnboardingSessionEntity): OnboardingProfile {
    return {
      id: entity.id,
      partnerId: entity.partnerId,
      lang: entity.lang,
      consent: entity.consentJson,
      name: entity.nameJson,
      contact: entity.contactJson,
      dateOfBirth: entity.dateOfBirthJson,
      identity: entity.identityJson as OnboardingProfile["identity"],
      progress: { ...entity.progressJson, totalSteps: 6 },
      revision: entity.revision,
      updatedAt: entity.updatedAt,
    };
  }
}
