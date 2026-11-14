import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JobEntity } from "../career/entities/job.entity";
import { SeedService } from "./seed.service";

@Module({
  imports: [TypeOrmModule.forFeature([JobEntity])],
  providers: [SeedService],
})
export class SeedModule {}
