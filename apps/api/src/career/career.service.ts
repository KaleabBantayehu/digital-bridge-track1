import { HttpStatus, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "crypto";
import { Repository } from "typeorm";
import { throwBilingualHttp, throwFieldValidation } from "../common/filters/bilingual-exception.filter";
import { OnboardingService } from "../onboarding/onboarding.service";
import { ApplicationEntity } from "./entities/application.entity";
import { JobEntity } from "./entities/job.entity";

const JOB_ACCOMMODATIONS = [
  "screen_reader_software",
  "flexible_hours",
  "remote_work",
  "sign_language_interpreter",
  "wheelchair_accessible",
  "quiet_workspace",
  "written_instructions",
  "extended_onboarding_time",
];

@Injectable()
export class CareerService {
  constructor(
    @InjectRepository(JobEntity) private readonly jobs: Repository<JobEntity>,
    @InjectRepository(ApplicationEntity) private readonly applications: Repository<ApplicationEntity>,
    private readonly onboarding: OnboardingService,
  ) {}

  async listJobs(query: { accommodations?: string; q?: string }) {
    let jobs = await this.jobs.find({ order: { createdAt: "DESC" } });
    const accommodations = (query.accommodations || "").split(",").filter(Boolean);
    if (accommodations.length) {
      jobs = jobs.filter((job) => accommodations.every((item) => job.offeredAccommodations.includes(item)));
    }
    if (query.q) {
      const term = query.q.toLowerCase();
      jobs = jobs.filter((job) => `${job.title} ${job.employer} ${job.location}`.toLowerCase().includes(term));
    }
    return jobs.map((job) => this.toJob(job));
  }

  async createJob(body: Record<string, any>) {
    if (!body.title || !body.employer || !body.location || !body.description) {
      throwFieldValidation("job", "REQUIRED");
    }
    const job = await this.jobs.save(this.jobs.create({
      id: randomUUID(),
      title: String(body.title).trim(),
      employer: String(body.employer).trim(),
      location: String(body.location).trim(),
      remote: Boolean(body.remote),
      deadlineIso: body.deadlineIso ? String(body.deadlineIso) : undefined,
      description: String(body.description).trim(),
      offeredAccommodations: Array.isArray(body.offeredAccommodations)
        ? body.offeredAccommodations.map(String)
        : [],
      contactEmail: body.contactEmail ? String(body.contactEmail).trim() : undefined,
      createdAt: new Date().toISOString(),
    }));
    return this.toJob(job);
  }

  async apply(body: Record<string, any>) {
    if (!body.jobId || !body.applicantProfileId || !Array.isArray(body.answers)) {
      throwFieldValidation("application", "REQUIRED");
    }
    const job = await this.jobs.findOne({ where: { id: String(body.jobId) } });
    if (!job) throwBilingualHttp(HttpStatus.NOT_FOUND, undefined, "NotFound");
    await this.onboarding.getSession(String(body.applicantProfileId));
    const adjustment = body.shareSupportWithEmployer === true && body.adjustmentRequest
      ? {
          items: Array.isArray(body.adjustmentRequest.items) ? body.adjustmentRequest.items.map(String) : [],
          note: body.adjustmentRequest.note ? String(body.adjustmentRequest.note) : undefined,
          shareConsent: true as const,
        }
      : undefined;
    return this.applications.save(this.applications.create({
      id: randomUUID(),
      jobId: String(body.jobId),
      applicantProfileId: String(body.applicantProfileId),
      answers: body.answers,
      adjustmentRequest: adjustment,
      submittedAt: new Date().toISOString(),
    }));
  }

  private toJob(job: JobEntity) {
    return {
      id: job.id,
      title: job.title,
      employer: job.employer,
      location: job.location,
      remote: job.remote,
      deadlineIso: job.deadlineIso,
      description: job.description,
      offeredAccommodations: job.offeredAccommodations,
      contactEmail: job.contactEmail,
      createdAt: job.createdAt,
      structuredData: {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        title: job.title,
        hiringOrganization: { "@type": "Organization", name: job.employer },
        jobLocation: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: job.location, addressCountry: "ET" } },
        description: job.description,
        datePosted: job.createdAt.slice(0, 10),
        validThrough: job.deadlineIso,
        jobLocationType: job.remote ? "TELECOMMUTE" : undefined,
      },
    };
  }
}
