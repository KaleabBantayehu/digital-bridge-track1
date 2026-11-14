import { Controller, Post, Patch, Get, Param, Body, Query } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional, ApiTags, ApiOperation } from "@nestjs/swagger";
import { IsIn, IsObject, IsOptional, IsString } from "class-validator";
import { OnboardingService } from "./onboarding.service";
import { Lang } from "@db/shared-schemas";

class CreateSessionDto {
  @ApiPropertyOptional({ enum: ["en", "am"], default: "en" })
  @IsOptional()
  @IsIn(["en", "am"])
  lang?: Lang;

  @ApiPropertyOptional({ default: "alx-demo" })
  @IsOptional()
  @IsString()
  partnerId?: string;
}

class PatchSessionDto {
  @ApiPropertyOptional({ enum: ["consent", "name", "contact", "dateOfBirth", "identity", "support", "progress"] })
  @IsOptional()
  @IsString()
  step?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

@ApiTags("Onboarding (/api/v1/onboarding)")
@Controller("onboarding")
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post("sessions")
  @ApiOperation({ summary: "Create a new offline-compatible onboarding session" })
  create(@Body() body: CreateSessionDto) {
    return this.onboardingService.createSession(body?.lang || "en", body?.partnerId || "alx-demo");
  }

  @Patch("sessions/:id")
  @ApiOperation({ summary: "Idempotently save step data and increment revision" })
  patch(@Param("id") id: string, @Body() body: PatchSessionDto) {
    return this.onboardingService.patchSession(id, body);
  }

  @Get("sessions/:id")
  @ApiOperation({ summary: "Retrieve onboarding session (support preferences excluded by default)" })
  get(
    @Param("id") id: string,
    @Query("includePrivateSupport") includePrivateSupport?: string
  ) {
    return this.onboardingService.getSession(id, includePrivateSupport === "true");
  }
}
