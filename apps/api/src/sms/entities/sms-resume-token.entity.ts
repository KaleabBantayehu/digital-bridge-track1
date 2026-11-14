import { Entity, PrimaryColumn, Column } from "typeorm";

@Entity("sms_resume_tokens")
export class SmsResumeTokenEntity {
  @PrimaryColumn()
  token!: string;

  @Column()
  sessionId!: string;

  @Column()
  phone!: string;

  @Column()
  expiresAt!: string;

  @Column({ default: false })
  used!: boolean;
}
