import { Controller, Post, Body, HttpStatus, UseGuards } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional, ApiTags, ApiOperation } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { IsBoolean, IsOptional, IsString } from "class-validator";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { randomUUID } from "crypto";
import { PartnerVoucherEntity } from "./entities/partner-voucher.entity";
import { OnboardingService } from "../onboarding/onboarding.service";
import { throwBilingualHttp } from "../common/filters/bilingual-exception.filter";
import { RequireScopes } from "../common/decorators/require-scopes.decorator";
import { ScopesGuard } from "../common/guards/scopes.guard";

class PartnerVouchDto {
  @ApiProperty()
  @IsString()
  sessionId!: string;

  @ApiProperty({ example: "AAAPD" })
  @IsString()
  partnerOrg!: string;

  @ApiProperty()
  @IsString()
  agentName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  agentRole?: string;

  @ApiProperty()
  @IsBoolean()
  learnerConsentConfirmed!: boolean;
}

@ApiTags("Partner Assisted Verification (/api/v1/onboarding)")
@Controller("onboarding")
export class VouchController {
  constructor(
    @InjectRepository(PartnerVoucherEntity)
    private readonly vouchRepo: Repository<PartnerVoucherEntity>,
    private readonly onboardingService: OnboardingService
  ) {}

  @Post("partner-vouch")
  @UseGuards(ScopesGuard)
  @RequireScopes("partner:vouch")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: "Partner organisation vouches for a learner without standard ID (with consent)" })
  async createVoucher(
    @Body() body: PartnerVouchDto
  ) {
    if (!body?.sessionId || !body?.partnerOrg || !body?.agentName || !body?.learnerConsentConfirmed) {
      throwBilingualHttp(HttpStatus.UNPROCESSABLE_ENTITY, "CONSENT_REQUIRED", "ValidationError");
    }

    const voucherId = "VOUCH-" + randomUUID().slice(0, 8).toUpperCase();
    const vouchedAt = new Date().toISOString();

    await this.vouchRepo.save({
      voucherId,
      sessionId: body.sessionId,
      partnerOrg: body.partnerOrg.trim(),
      agentName: body.agentName.trim(),
      agentRole: (body.agentRole || "Caseworker").trim(),
      learnerConsentConfirmed: true,
      vouchedAt,
    });

    await this.onboardingService.patchSession(body.sessionId, {
      step: "identity",
      data: {
        route: "partner_vouch",
        partnerOrg: body.partnerOrg.trim(),
        partnerAgentName: body.agentName.trim(),
        voucherCode: voucherId,
        vouchedWithLearnerConsent: true,
        vouchedAt,
      },
    });

    return {
      voucherId,
      verified: true,
      vouchedAt,
    };
  }
}
