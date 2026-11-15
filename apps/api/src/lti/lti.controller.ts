import { Controller, Get, Post, Req, Res } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Request, Response } from "express";
import {
  LtiAdvantageService,
  LtiGradeReceipt,
} from "./lti-advantage.service";
import { JsonWebKeySet, KeysService } from "./keys.service";
import { LtiService } from "./lti.service";
import { MockPlatformService } from "./mock-platform.service";

@ApiTags("lti")
@Controller("lti")
export class LtiController {
  constructor(
    private readonly keysService: KeysService,
    private readonly ltiService: LtiService,
    private readonly ltiAdvantageService: LtiAdvantageService,
    private readonly mockPlatformService: MockPlatformService,
  ) {}

  @Get("jwks")
  getJwks(): JsonWebKeySet {
    return this.keysService.getPublicJwks();
  }

  @Get("login")
  @ApiOperation({ summary: "Start an LTI 1.3 login from a trusted platform" })
  @ApiResponse({ status: 302, description: "Redirects to the registered platform." })
  async startLoginGet(@Req() request: Request, @Res() response: Response): Promise<void> {
    this.startLogin(request.query, response);
  }

  @Post("login")
  @ApiOperation({ summary: "Start an LTI 1.3 login from a trusted platform" })
  @ApiResponse({ status: 302, description: "Redirects to the registered platform." })
  async startLoginPost(@Req() request: Request, @Res() response: Response): Promise<void> {
    this.startLogin(request.body, response);
  }

  @Get("mock-platform/jwks")
  getMockPlatformJwks(): JsonWebKeySet {
    return this.mockPlatformService.getPublicJwks();
  }

  @Post("mock-platform/sign-launch")
  @ApiOperation({ summary: "Sign a development-only LTI launch for automated tests" })
  async signMockLaunch(@Req() request: Request): Promise<{
    id_token: string;
    state?: string;
  }> {
    return this.mockPlatformService.signLaunch(request.body);
  }

  @Post("launch")
  @ApiOperation({ summary: "Verify an LTI 1.3 launch" })
  @ApiResponse({ status: 200, description: "Returns a short-lived LTI session token." })
  @ApiResponse({ status: 401, description: "Rejects an invalid or replayed launch." })
  async launch(@Req() request: Request, @Res() response: Response): Promise<void> {
    response.setHeader("Set-Cookie", this.clearStateCookie());
    const cookieValue = this.readStateCookie(request.headers.cookie);
    const result = await this.ltiService.verifyLaunch(request.body, cookieValue);
    if (request.headers.accept?.includes("text/html")) {
      response
        .status(200)
        .type("html")
        .send(
          this.renderLaunchCompletion(
            result.sessionToken,
            result.platformOrigin,
            result.profile.role,
            result.messageType,
          ),
        );
      return;
    }
    response.status(200).json({
      verified: true,
      role: result.profile.role,
      learner: {
        sub: result.profile.id,
        ...(result.profile.givenName ? { givenName: result.profile.givenName } : {}),
        ...(result.profile.familyName ? { familyName: result.profile.familyName } : {}),
        ...(result.profile.email ? { email: result.profile.email } : {}),
        ...(result.profile.lang ? { lang: result.profile.lang } : {}),
      },
      sessionToken: result.sessionToken,
      targetLinkUri: result.targetLinkUri,
      messageType: result.messageType,
      profile: result.profile,
    });
  }

  @Post("ags/sync")
  @ApiOperation({ summary: "Send an onboarding completion score to the LTI gradebook" })
  @ApiResponse({ status: 200, description: "Reports whether the grade was newly synchronized." })
  async syncGrade(@Req() request: Request): Promise<{
    synced: true;
    alreadySynced: boolean;
    grade: LtiGradeReceipt;
  }> {
    return this.ltiAdvantageService.syncGrade(
      request.headers.authorization,
      request.body,
    );
  }

  @Get("ags/grades")
  @ApiOperation({ summary: "Read privacy-safe LTI grade receipts for this course" })
  async getGrades(@Req() request: Request): Promise<{
    grades: LtiGradeReceipt[];
  }> {
    return this.ltiAdvantageService.getGrades(request.headers.authorization);
  }

  @Get("nrps/roster")
  @ApiOperation({ summary: "Return an instructor's roster with onboarding status only" })
  @ApiResponse({ status: 200, description: "Returns names and completion booleans only." })
  async getRoster(
    @Req() request: Request,
  ): Promise<{ members: Array<{ name: string; onboardingComplete: boolean }> }> {
    return this.ltiAdvantageService.getRoster(request.headers.authorization);
  }

  @Post("deep-link")
  @ApiOperation({ summary: "Return an LTI Deep Linking response to a platform" })
  @ApiResponse({ status: 200, description: "Returns a signed Deep Linking response form." })
  async returnDeepLink(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const form = await this.ltiAdvantageService.createDeepLinkResponse(
      request.headers.authorization,
    );
    response.status(200).type("html").send(form);
  }

  private startLogin(value: unknown, response: Response): void {
    const result = this.ltiService.initiateLogin(value);
    response.setHeader("Set-Cookie", this.createStateCookie(result.cookieValue));
    const input =
      typeof value === "object" && value !== null
        ? (value as Record<string, unknown>)
        : undefined;
    const redirect = input?.redirect !== false && input?.redirect !== "false";
    if (!redirect) {
      response.status(200).json({
        state: result.state,
        nonce: result.nonce,
        authUrl: result.redirectUrl,
        redirectUrl: result.redirectUrl,
      });
      return;
    }
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

  private renderLaunchCompletion(
    sessionToken: string,
    platformOrigin: string,
    role: "Learner" | "Instructor",
    messageType: "LtiResourceLinkRequest" | "LtiDeepLinkingRequest",
  ): string {
    const tokenJson = JSON.stringify(sessionToken);
    const originJson = JSON.stringify(platformOrigin);
    const roleJson = JSON.stringify(role);
    const messageTypeJson = JSON.stringify(messageType);
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Learning platform sign-in complete</title>
  </head>
  <body>
    <main>
      <h1>Sign-in complete</h1>
      <p>You can return to your learning platform.</p>
    </main>
    <script>
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          {
            type: "db-lti-launch",
            sessionToken: ${tokenJson},
            role: ${roleJson},
            messageType: ${messageTypeJson}
          },
          ${originJson}
        );
        window.close();
      }
    </script>
  </body>
</html>`;
  }
}
