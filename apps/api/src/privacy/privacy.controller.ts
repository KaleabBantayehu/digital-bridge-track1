import { Controller, Delete, Get, Query, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PrivacyService } from "./privacy.service";

@ApiTags("Privacy")
@Controller("privacy")
export class PrivacyController {
  constructor(private readonly service: PrivacyService) {}

  @Get("export")
  @ApiOperation({ summary: "Export all data held for a learner" })
  export(@Query("sessionId") sessionId: string) {
    return this.service.export(sessionId);
  }

  @Delete("data")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Permanently delete learner data" })
  async remove(@Query("sessionId") sessionId: string) {
    await this.service.remove(sessionId);
  }
}
