import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JobEntity } from "../career/entities/job.entity";

const jobs = [
  ["Customer Support Agent", "Addis Digital Services", "Addis Ababa", true, ["screen_reader_software", "flexible_hours", "written_instructions"]],
  ["Junior Software Tester", "Blue Nile Technologies", "Addis Ababa", false, ["quiet_workspace", "extended_onboarding_time", "written_instructions"]],
  ["Data Entry Assistant", "Horizon Cooperative", "Bahir Dar", true, ["remote_work", "flexible_hours", "screen_reader_software"]],
  ["Inclusive Education Tutor", "Learning for All Ethiopia", "Addis Ababa", false, ["wheelchair_accessible", "sign_language_interpreter", "written_instructions"]],
  ["Call Centre and Chat Assistant", "Awash Microfinance", "Addis Ababa", false, ["written_instructions", "quiet_workspace", "flexible_hours"]],
  ["Community Outreach Coordinator", "Mercy Corps Ethiopia", "Dire Dawa", false, ["wheelchair_accessible", "flexible_hours", "extended_onboarding_time"]],
  ["Remote Content Reviewer", "Ethiopian Digital Works", "Regional Ethiopia", true, ["remote_work", "screen_reader_software", "quiet_workspace"]],
  ["Office Administration Trainee", "Unity Manufacturing", "Addis Ababa", false, ["wheelchair_accessible", "written_instructions", "extended_onboarding_time"]],
] as const;

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(@InjectRepository(JobEntity) private readonly jobsRepo: Repository<JobEntity>) {}

  async onModuleInit() {
    if (await this.jobsRepo.count() > 0) return;
    const now = new Date().toISOString();
    await this.jobsRepo.save(jobs.map((job, index) => this.jobsRepo.create({
      id: `seed-job-${index + 1}`,
      title: job[0],
      employer: job[1],
      location: job[2],
      remote: job[3],
      description: `${job[0]} opportunity in ${job[2]}. Training and an accessible onboarding process are provided.`,
      offeredAccommodations: [...job[4]],
      createdAt: now,
    })));
  }
}
