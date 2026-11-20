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

  @Get("install")
  @ApiOperation({ summary: "One page of copy-ready values to install the tool in Moodle, Canvas or any LTI 1.3 platform" })
  getInstallGuide(@Req() request: Request): Record<string, unknown> {
    const urls = this.toolUrls(request);
    return {
      tool: "Digital Bridge Accessible Onboarding",
      canvas: {
        steps: "Admin > Developer Keys > + LTI Key > Method: Enter URL > paste configUrl > Save, then turn the key ON and add the app by Client ID.",
        configUrl: urls.canvasConfig,
      },
      moodle: {
        steps: "Site administration > Plugins > Activity modules > External tool > Manage tools > configure a tool manually. Set LTI version to LTI 1.3 and Public key type to Keyset URL, then paste the fields below.",
        fields: {
          "Tool URL": urls.targetLink,
          "LTI version": "LTI 1.3",
          "Public key type": "Keyset URL",
          "Public keyset": urls.jwks,
          "Initiate login URL": urls.login,
          "Redirection URI(s)": [urls.launch, urls.deepLink].join("\n"),
          "Supports Deep Linking (Content-Item Message)": "Yes",
        },
      },
      afterInstall: "Send the platform issuer, client ID, deployment ID and its keyset URL to the Digital Bridge team. They are added to LTI_PLATFORMS_JSON so launches are verified with RS256.",
    };
  }

  @Get("install/canvas.json")
  @ApiOperation({ summary: "Canvas LTI 1.3 developer key configuration (paste this URL into Canvas)" })
  getCanvasConfig(@Req() request: Request): Record<string, unknown> {
    const urls = this.toolUrls(request);
    const host = new URL(urls.base).hostname;
    return {
      title: "Digital Bridge Accessible Onboarding",
      description: "Bilingual (English and Amharic), keyboard and screen reader friendly onboarding and an accessible career gateway.",
      oidc_initiation_url: urls.login,
      target_link_uri: urls.targetLink,
      public_jwk_url: urls.jwks,
      scopes: [
        "https://purl.imsglobal.org/spec/lti-ags/scope/score",
        "https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly",
      ],
      extensions: [
        {
          domain: host,
          platform: "canvas.instructure.com",
          privacy_level: "name_only",
          settings: {
            placements: [
              { placement: "course_navigation", message_type: "LtiResourceLinkRequest", target_link_uri: urls.targetLink, text: "Accessible onboarding" },
              { placement: "link_selection", message_type: "LtiDeepLinkingRequest", target_link_uri: urls.deepLink, text: "Digital Bridge" },
            ],
          },
        },
      ],
      custom_fields: { partner_id: "canvas" },
    };
  }

  private toolUrls(request: Request) {
    // Prefer the configured public origin; otherwise use the origin this request reached (trust proxy is on).
    let base = `${request.protocol}://${request.get("host")}`;
    try {
      if (process.env.LTI_TOOL_BASE_URL) base = new URL(process.env.LTI_TOOL_BASE_URL).origin;
    } catch {
      /* keep the request origin */
    }
    let targetLink = new URL("/api/v1/lti/launch", base).toString();
    try {
      const configured = JSON.parse(process.env.LTI_TOOL_TARGET_LINK_URIS || "[]");
      if (Array.isArray(configured) && typeof configured[0] === "string") targetLink = configured[0];
    } catch {
      /* keep the launch URL */
    }
    const at = (path: string) => new URL(path, base).toString();
    return {
      base,
      targetLink,
      login: at("/api/v1/lti/login"),
      launch: at("/api/v1/lti/launch"),
      deepLink: at("/api/v1/lti/deep-link"),
      jwks: at("/api/v1/lti/jwks"),
      canvasConfig: at("/api/v1/lti/install/canvas.json"),
    };
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
