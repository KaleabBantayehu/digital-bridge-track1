import { Body, Controller, ForbiddenException, Post, UnauthorizedException } from "@nestjs/common";
import { ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";
import { IsArray, IsOptional, IsString } from "class-validator";
import { SignJWT } from "jose";

class TokenRequestDto {
  @ApiProperty({ example: "demo-partner" })
  @IsString()
  clientId!: string;

  @ApiProperty({ example: "demo-secret" })
  @IsString()
  clientSecret!: string;

  @ApiProperty({ type: [String], example: ["partner:vouch"] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  scopes: string[] = [];
}

@ApiTags("OAuth 2.0")
@Controller("auth")
export class AuthController {
  @Post("token")
  @ApiOperation({ summary: "Issue a development partner bearer token" })
  async token(@Body() body: TokenRequestDto) {
    const clients = this.allowedClients();
    const client = clients[body.clientId];
    if (!client || client.secret !== body.clientSecret) {
      throw new UnauthorizedException("Invalid client credentials");
    }
    if (body.scopes.some((scope) => !client.scopes.includes(scope))) {
      throw new ForbiddenException("Requested scope is not allowed for this client");
    }
    const scope = body.scopes.join(" ").trim();
    const accessToken = await new SignJWT({ scope, scopes: body.scopes })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(body.clientId)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(
        process.env.JWT_SECRET || "dev-bridge-oauth-secret-2026",
      ));

    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 3600,
      scope,
    };
  }

  private allowedClients(): Record<string, { secret: string; scopes: string[] }> {
    const defaults = {
      "judge-client": { secret: "judge-secret", scopes: ["onboarding:read"] },
      "judge-partner": { secret: "judge-secret", scopes: ["partner:vouch"] },
      "alx-savanna": { secret: "alx-savanna-secret", scopes: ["onboarding:read", "onboarding:write", "privacy:read", "privacy:delete", "jobs:read"] },
      "partner-demo": { secret: "partner-demo-secret", scopes: ["onboarding:read", "onboarding:write", "partner:vouch"] },
      aaapd: { secret: "aaapd-secret", scopes: ["onboarding:read", "onboarding:write", "partner:vouch"] },
      snv: { secret: "snv-secret", scopes: ["onboarding:read", "onboarding:write", "partner:vouch"] },
    };
    const raw = process.env.PARTNER_CLIENTS;
    if (!raw) return defaults;
    try {
      const parsed = JSON.parse(raw) as Record<string, { secret: string; scopes: string[] }>;
      return { ...defaults, ...parsed };
    } catch {
      throw new Error("PARTNER_CLIENTS must be valid JSON");
    }
  }
}
