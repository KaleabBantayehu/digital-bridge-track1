import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OnboardingModule } from "../onboarding/onboarding.module";
import { VouchController } from "./vouch.controller";
import { PartnerVoucherEntity } from "./entities/partner-voucher.entity";

@Module({
  imports: [TypeOrmModule.forFeature([PartnerVoucherEntity]), OnboardingModule],
  controllers: [VouchController],
})
export class VouchModule {}
