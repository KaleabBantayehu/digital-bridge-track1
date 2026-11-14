import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { CareerService } from "./career.service";

@ApiTags("Career Gateway")
@Controller("career")
export class CareerController {
  constructor(private readonly service: CareerService) {}

  @Get("jobs")
  @ApiOperation({ summary: "List jobs without associating private filters with a learner" })
  list(@Query() query: { accommodations?: string; q?: string }) {
    return this.service.listJobs(query);
  }

  @Post("jobs")
  @ApiOperation({ summary: "Post a job with workplace accommodations" })
  create(@Body() body: Record<string, any>) {
    return this.service.createJob(body);
  }

  @Post("applications")
  @ApiOperation({ summary: "Submit a job application" })
  apply(@Body() body: Record<string, any>) {
    return this.service.apply(body);
  }
}
