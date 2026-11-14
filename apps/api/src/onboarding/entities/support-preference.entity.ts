import { Entity, PrimaryColumn, Column } from "typeorm";
import { SupportPreferences } from "@db/shared-schemas";

/**
 * Stored in a strictly separate table from OnboardingSessionEntity so that
 * employer/public queries and LTI roster exports never leak private support needs.
 */
@Entity("support_preferences")
export class SupportPreferenceEntity {
  @PrimaryColumn()
  sessionId!: string;

  @Column({ type: "simple-json" })
  preferencesJson!: SupportPreferences;

  @Column()
  updatedAt!: string;
}
