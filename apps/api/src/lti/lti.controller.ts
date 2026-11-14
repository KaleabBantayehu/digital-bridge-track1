import { Controller, Get, Post, Req, Res } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Request, Response } from "express";
import { JsonWebKeySet, KeysService } from "./keys.service";
import { LtiService } from "./lti.service";

@ApiTags("lti")
@Controller("lti")
export class LtiController {
  constructor(
    private readonly keysService: KeysService,
    private readonly ltiService: LtiService,
  ) {}

  @Get("jwks")
  getJwks(): JsonWebKeySet {
    return this.keysService.getPublicJwks();
  }

  @Get("login")
  @ApiOperation({ summary: "Start an LTI 1.3 login from a trusted platform" })
  @ApiResponse({ status: 302, description: "Redirects to the registered platform." })
  async startLoginGet(@Req() request: Request, @Res() response: Response): Promise<void> {
    await this.startLogin(request.query, response);
  }

  @Post("login")
  @ApiOperation({ summary: "Start an LTI 1.3 login from a trusted platform" })
  @ApiResponse({ status: 302, description: "Redirects to the registered platform." })
  async startLoginPost(@Req() request: Request, @Res() response: Response): Promise<void> {
    await this.startLogin(request.body, response);
  }

  @Post("launch")
  @ApiOperation({ summary: "Verify an LTI 1.3 launch" })
  @ApiResponse({ status: 200, description: "Returns a short-lived LTI session token." })
  @ApiResponse({ status: 401, description: "Rejects an invalid or replayed launch." })
  async launch(@Req() request: Request, @Res() response: Response): Promise<void> {
    response.setHeader("Set-Cookie", this.clearStateCookie());
    const cookieValue = this.readStateCookie(request.headers.cookie);
    const result = await this.ltiService.verifyLaunch(request.body, cookieValue);
    response.status(200).json(result);
  }

  private async startLogin(value: unknown, response: Response): Promise<void> {
    const result = this.ltiService.initiateLogin(value);
    response.setHeader("Set-Cookie", this.createStateCookie(result.cookieValue));
    response.redirect(302, result.redirectUrl);
  }

  private readStateCookie(cookieHeader: string | undefined): string | undefined {
    if (!cookieHeader) {
      return undefined;
    }
    const cookieName = this.ltiService.getStateCookieName();
    for (const part of cookieHeader.split(";")) {
      const separator = part.indexOf("=");
      if (separator < 0 || part.slice(0, separator).trim() !== cookieName) {
        continue;
      }
      return part.slice(separator + 1).trim();
    }
    return undefined;
  }

  private createStateCookie(value: string): string {
    const secure = process.env.NODE_ENV === "production";
    const sameSite = secure ? "None" : "Lax";
    return [
      `${this.ltiService.getStateCookieName()}=${value}`,
      `Path=${this.ltiService.getStateCookiePath()}`,
      "HttpOnly",
      `SameSite=${sameSite}`,
      "Max-Age=300",
      ...(secure ? ["Secure"] : []),
    ].join("; ");
  }

  private clearStateCookie(): string {
    const secure = process.env.NODE_ENV === "production";
    const sameSite = secure ? "None" : "Lax";
    return [
      `${this.ltiService.getStateCookieName()}=`,
      `Path=${this.ltiService.getStateCookiePath()}`,
      "HttpOnly",
      `SameSite=${sameSite}`,
      "Max-Age=0",
      ...(secure ? ["Secure"] : []),
    ].join("; ");
  }
}
