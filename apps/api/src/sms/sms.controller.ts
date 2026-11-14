import { Controller, Post, Get, Param, Body } from "@nestjs/common";
import { ApiProperty, ApiTags, ApiOperation } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { IsString } from "class-validator";
import { SmsService } from "./sms.service";

class ResumeSmsDto {
  @ApiProperty({ example: "0911 234 567" })
  @IsString()
  phone!: string;
}

@ApiTags("SMS Save & Resume (/api/v1/onboarding)")
@Controller("onboarding")
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  @Post("sessions/:id/resume-sms")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: "Send a 24h single-use SMS resume link to an Ethiopian phone number" })
  requestSms(@Param("id") id: string, @Body() body: ResumeSmsDto) {
    return this.smsService.createResumeLink(id, body?.phone);
  }

  @Get("resume/:token")
  @ApiOperation({ summary: "Restore an onboarding session from a single-use SMS token" })
  resume(@Param("token") token: string) {
    return this.smsService.consumeResumeToken(token);
  }
}
