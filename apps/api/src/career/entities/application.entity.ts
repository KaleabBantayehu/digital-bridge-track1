import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("job_applications")
export class ApplicationEntity {
  @PrimaryColumn()
  id!: string;

  @Column()
  jobId!: string;

  @Column()
  applicantProfileId!: string;

  @Column({ type: "simple-json" })
  answers!: unknown[];

  @Column({ type: "simple-json", nullable: true })
  adjustmentRequest?: { items: string[]; note?: string; shareConsent: true };

  @Column()
  submittedAt!: string;
}
