import { Entity, PrimaryColumn, Column } from "typeorm";

@Entity("onboarding_sessions")
export class OnboardingSessionEntity {
  @PrimaryColumn()
  id!: string;

  @Column({ default: "alx-demo" })
  partnerId!: string;

  @Column({ default: "en" })
  lang!: "en" | "am";

  @Column({ type: "simple-json" })
  consentJson!: {
    saveAnswers: boolean;
    smsResume: boolean;
    shareWithEmployers: boolean;
    givenAt: string;
  };

  @Column({ type: "simple-json" })
  nameJson!: {
    givenName: string;
    familyName: string;
    preferredName?: string;
  };

  @Column({ type: "simple-json" })
  contactJson!: {
    phone?: string;
    email?: string;
    viaPartner?: boolean;
  };

  @Column({ type: "simple-json", nullable: true })
  dateOfBirthJson?: {
    iso: string;
    displayCalendar: "ethiopian" | "gregorian";
    ethiopian?: { year: number; month: number; day: number };
  };

  @Column({ type: "simple-json", nullable: true })
  identityJson?: Record<string, unknown>;

  @Column({ type: "simple-json" })
  progressJson!: {
    currentStep: number;
    totalSteps: 6;
    completedSteps: number[];
    completedAt?: string;
  };

  @Column({ default: 1 })
  revision!: number;

  @Column()
  updatedAt!: string;
}
