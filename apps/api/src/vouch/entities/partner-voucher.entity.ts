import { Entity, PrimaryColumn, Column } from "typeorm";

@Entity("partner_vouchers")
export class PartnerVoucherEntity {
  @PrimaryColumn()
  voucherId!: string;

  @Column()
  sessionId!: string;

  @Column()
  partnerOrg!: string;

  @Column()
  agentName!: string;

  @Column()
  agentRole!: string;

  @Column()
  learnerConsentConfirmed!: boolean;

  @Column()
  vouchedAt!: string;
}
