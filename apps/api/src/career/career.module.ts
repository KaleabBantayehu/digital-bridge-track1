import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OnboardingModule } from "../onboarding/onboarding.module";
import { ApplicationEntity } from "./entities/application.entity";
import { JobEntity } from "./entities/job.entity";
import { CareerController } from "./career.controller";
import { CareerService } from "./career.service";

@Module({
  imports: [TypeOrmModule.forFeature([JobEntity, ApplicationEntity]), OnboardingModule],
  controllers: [CareerController],
  providers: [CareerService],
  exports: [CareerService],
})
export class CareerModule {}
