import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity("jobs")
export class JobEntity {
  @PrimaryColumn()
  id!: string;

  @Column()
  title!: string;

  @Column()
  employer!: string;

  @Column()
  location!: string;

  @Column({ default: false })
  remote!: boolean;

  @Column({ nullable: true })
  deadlineIso?: string;

  @Column()
  description!: string;

  @Column({ type: "simple-json" })
  offeredAccommodations!: string[];

  @Column({ nullable: true })
  contactEmail?: string;

  @Column()
  createdAt!: string;
}
