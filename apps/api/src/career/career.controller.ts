import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsObject, IsOptional, IsString } from "class-validator";
import { CareerService } from "./career.service";
import { RequireScopes } from "../common/decorators/require-scopes.decorator";
import { ScopesGuard } from "../common/guards/scopes.guard";

class JobQueryDto {
  @ApiPropertyOptional({ example: "screen_reader_software,flexible_hours" })
  @IsOptional()
  @IsString()
  accommodations?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;
}

class CreateJobDto {
  @ApiProperty()
  @IsString()
  title!: string;
  @ApiProperty()
  @IsString()
  employer!: string;
  @ApiProperty()
  @IsString()
  location!: string;
  @ApiProperty()
  @IsString()
  description!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  remote?: boolean;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  offeredAccommodations?: string[];
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deadlineIso?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactEmail?: string;
}

class CreateApplicationDto {
  @ApiProperty()
  @IsString()
  jobId!: string;
  @ApiProperty()
  @IsString()
  applicantProfileId!: string;
  @ApiProperty({ type: [Object] })
  @IsArray()
  answers!: unknown[];
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  shareSupportWithEmployer?: boolean;
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  adjustmentRequest?: Record<string, unknown>;
}

@ApiTags("Career Gateway")
@Controller("career")
export class CareerController {
  constructor(private readonly service: CareerService) {}

  @Get("jobs")
  @ApiOperation({ summary: "List jobs without associating private filters with a learner" })
  list(@Query() query: JobQueryDto) {
    return this.service.listJobs(query);
  }

  @Post("jobs")
  @UseGuards(ScopesGuard)
  @RequireScopes("career:write")
  @ApiOperation({ summary: "Post a job with workplace accommodations" })
  create(@Body() body: CreateJobDto) {
    return this.service.createJob(body);
  }

  @Post("applications")
  @ApiOperation({ summary: "Submit a job application" })
  apply(@Body() body: CreateApplicationDto) {
    return this.service.apply(body);
  }
}
