import { Controller, Delete, Get, Query, HttpCode, HttpStatus, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PrivacyService } from "./privacy.service";
import { RequireScopes } from "../common/decorators/require-scopes.decorator";
import { ScopesGuard } from "../common/guards/scopes.guard";

@ApiTags("Privacy")
@Controller("privacy")
export class PrivacyController {
  constructor(private readonly service: PrivacyService) {}

  @Get("export")
  @UseGuards(ScopesGuard)
  @RequireScopes("privacy:read")
  @ApiOperation({ summary: "Export all data held for a learner" })
  export(@Query("sessionId") sessionId: string) {
    return this.service.export(sessionId);
  }

  @Delete("data")
  @UseGuards(ScopesGuard)
  @RequireScopes("privacy:delete")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Permanently delete learner data" })
  async remove(@Query("sessionId") sessionId: string) {
    await this.service.remove(sessionId);
  }
}
