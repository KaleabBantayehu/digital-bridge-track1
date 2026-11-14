import { Controller, Post, Patch, Get, Param, Body, Query } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { OnboardingService } from "./onboarding.service";
import { Lang } from "@db/shared-schemas";

@ApiTags("Onboarding (/api/v1/onboarding)")
@Controller("onboarding")
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post("sessions")
  @ApiOperation({ summary: "Create a new offline-compatible onboarding session" })
  create(@Body() body: { lang?: Lang; partnerId?: string }) {
    return this.onboardingService.createSession(body?.lang || "en", body?.partnerId || "alx-demo");
  }

  @Patch("sessions/:id")
  @ApiOperation({ summary: "Idempotently save step data and increment revision" })
  patch(@Param("id") id: string, @Body() body: Record<string, any>) {
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
