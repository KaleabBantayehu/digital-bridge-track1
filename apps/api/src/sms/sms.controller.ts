import { Controller, Post, Get, Param, Body } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { SmsService } from "./sms.service";

@ApiTags("SMS Save & Resume (/api/v1/onboarding)")
@Controller("onboarding")
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  @Post("sessions/:id/resume-sms")
  @ApiOperation({ summary: "Send a 24h single-use SMS resume link to an Ethiopian phone number" })
  requestSms(@Param("id") id: string, @Body() body: { phone: string }) {
    return this.smsService.createResumeLink(id, body?.phone);
  }

  @Get("resume/:token")
  @ApiOperation({ summary: "Restore an onboarding session from a single-use SMS token" })
  resume(@Param("token") token: string) {
    return this.smsService.consumeResumeToken(token);
  }
}
