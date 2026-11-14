import { Body, Controller, Post } from "@nestjs/common";
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
}
