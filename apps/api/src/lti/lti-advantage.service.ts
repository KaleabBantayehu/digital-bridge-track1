import { Injectable } from "@nestjs/common";
import {
  importJWK,
  jwtVerify,
  SignJWT,
} from "jose";
import { randomBytes } from "node:crypto";
import { KeysService } from "./keys.service";
import { LtiRequestException } from "./lti.service";
import { PlatformRegistration, PlatformRegistry } from "./platform.registry";

const AGS_SCORE_SCOPE = "https://purl.imsglobal.org/spec/lti-ags/scope/score";
const NRPS_READ_SCOPE =
  "https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly";
const CLIENT_ASSERTION_TYPE =
  "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";
const SERVICE_TIMEOUT_MS = 5_000;
const DEEP_LINKING_MESSAGE_TYPE =
  "https://purl.imsglobal.org/spec/lti/claim/message_type";
const LTI_VERSION_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/version";
const LTI_DEPLOYMENT_ID_CLAIM =
  "https://purl.imsglobal.org/spec/lti/claim/deployment_id";
const LTI_DEEP_LINKING_CONTENT_ITEMS_CLAIM =
  "https://purl.imsglobal.org/spec/lti-dl/claim/content_items";
const LTI_DEEP_LINKING_DATA_CLAIM = "https://purl.imsglobal.org/spec/lti-dl/claim/data";

interface TrustedLtiSession {
  sub: string;
  role: "Learner" | "Instructor";
  contextId: string;
  platformIssuer: string;
  platformClientId: string;
  deploymentId: string;
  messageType: "LtiResourceLinkRequest" | "LtiDeepLinkingRequest";
  targetLinkUri: string;
  agsLineItem?: string;
  agsScopes?: string[];
  nrpsUrl?: string;
  deepLinkReturnUrl?: string;
  deepLinkData?: string;
}

export interface LtiGradeReceipt {
  sessionId: string;
  userId: string;
  scoreGiven: 1;
  scoreMaximum: 1;
  activityProgress: "Completed";
  gradingProgress: "FullyGraded";
  receiptId: string;
  syncedAt: string;
}

export interface LtiNrpsMember {
  name: string;
  role: string;
  status: "Completed" | "In Progress";
}

@Injectable()
export class LtiAdvantageService {
  private readonly completedLearners = new Set<string>();
  private readonly synchronizedGrades = new Map<string, LtiGradeReceipt>();

  constructor(
    private readonly keysService: KeysService,
    private readonly platformRegistry: PlatformRegistry,
  ) {}

  async syncGrade(
    authorization: string | undefined,
    submittedGrade?: unknown,
  ): Promise<{
    synced: true;
    alreadySynced: boolean;
    grade: LtiGradeReceipt;
  }> {
    const session = await this.verifySession(authorization);
    if (session.role !== "Learner") {
      throw new LtiRequestException(403, "LTI_BAD_AUDIENCE");
    }
    this.validateGradeSubmission(submittedGrade, session);
    if (!session.agsLineItem || !session.agsScopes?.includes(AGS_SCORE_SCOPE)) {
      throw new LtiRequestException(403, "LTI_BAD_AUDIENCE");
    }

    const platform = this.getPlatform(session);
    const idempotencyKey = this.completionKey(session);
    const existingReceipt = this.synchronizedGrades.get(idempotencyKey);
    if (existingReceipt) {
      return {
        synced: true,
        alreadySynced: true,
        grade: { ...existingReceipt },
      };
    }

    const accessToken = await this.getPlatformAccessToken(platform, AGS_SCORE_SCOPE);
    const scoreUrl = this.getScoreUrl(session.agsLineItem);
    const response = await this.fetchService(scoreUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/vnd.ims.lis.v1.score+json",
      },
      body: JSON.stringify({
        userId: session.sub,
        scoreGiven: 1,
        scoreMaximum: 1,
        activityProgress: "Completed",
        gradingProgress: "FullyGraded",
        timestamp: new Date().toISOString(),
      }),
    });
    if (!response.ok) {
      throw new LtiRequestException(502, "REQUIRED");
    }

    const receipt: LtiGradeReceipt = {
      sessionId: session.contextId,
      userId: session.sub,
      scoreGiven: 1,
      scoreMaximum: 1,
      activityProgress: "Completed",
      gradingProgress: "FullyGraded",
      receiptId: randomBytes(24).toString("base64url"),
      syncedAt: new Date().toISOString(),
    };
    this.synchronizedGrades.set(idempotencyKey, receipt);
    this.completedLearners.add(idempotencyKey);
    return { synced: true, alreadySynced: false, grade: { ...receipt } };
  }

  async getGrades(authorization: string | undefined): Promise<{
    grades: LtiGradeReceipt[];
  }> {
    const session = await this.verifySession(authorization);
    const grades = [...this.synchronizedGrades.values()]
      .filter(
        (grade) =>
          grade.sessionId === session.contextId &&
          (session.role === "Instructor" || grade.userId === session.sub),
      )
      .map((grade) => ({ ...grade }));
    return { grades };
  }

  async getRoster(authorization: string | undefined): Promise<{
    members: Array<LtiNrpsMember & { onboardingComplete: boolean }>;
  }> {
    const session = await this.verifySession(authorization);
    if (session.role !== "Instructor") {
      throw new LtiRequestException(403, "LTI_BAD_AUDIENCE");
    }
    if (!session.nrpsUrl) {
      throw new LtiRequestException(403, "LTI_BAD_AUDIENCE");
    }

    const platform = this.getPlatform(session);
    const accessToken = await this.getPlatformAccessToken(platform, NRPS_READ_SCOPE);
    const response = await this.fetchService(session.nrpsUrl, {
      method: "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/vnd.ims.lti-nrps.v2.membershipcontainer+json",
      },
    });
    if (!response.ok) {
      throw new LtiRequestException(502, "REQUIRED");
    }

    const body = await this.readJson(response);
    const members = this.asRecord(body)?.members;
    if (!Array.isArray(members)) {
      throw new LtiRequestException(502, "REQUIRED");
    }

    return {
      members: members
        .map((value) => this.asRecord(value))
        .filter(
          (member): member is Record<string, unknown> & { user_id: string } =>
            member !== undefined && typeof member.user_id === "string",
        )
        .map((member) => {
          const userId = member.user_id;
          const name =
            typeof member.name === "string" && member.name.trim()
              ? member.name.trim()
              : [member.given_name, member.family_name]
                  .filter((part): part is string => typeof part === "string" && Boolean(part.trim()))
                  .join(" ")
                  .trim() || "Learner";
          const memberRoles = Array.isArray(member.roles)
            ? member.roles.filter(
                (role): role is string =>
                  typeof role === "string" &&
                  (role.endsWith("#Learner") || role.endsWith("#Instructor")),
              )
            : [];
          const role = memberRoles.some((value) => value.endsWith("#Instructor"))
            ? "Instructor"
            : "Learner";
          const onboardingComplete = this.completedLearners.has(
            this.completionKey({ ...session, sub: userId }),
          );
          return {
            name,
            role,
            status: onboardingComplete ? "Completed" : "In Progress",
            onboardingComplete,
          };
        }),
    };
  }

  async createDeepLinkResponse(authorization: string | undefined): Promise<string> {
    const session = await this.verifySession(authorization);
    if (
      session.role !== "Instructor" ||
      session.messageType !== "LtiDeepLinkingRequest" ||
      !session.deepLinkReturnUrl
    ) {
      throw new LtiRequestException(403, "LTI_BAD_AUDIENCE");
    }

    const platform = this.getPlatform(session);
    const returnUrl = new URL(session.deepLinkReturnUrl);
    if (returnUrl.origin !== new URL(platform.issuer).origin) {
      throw new LtiRequestException(403, "LTI_BAD_AUDIENCE");
    }

    const publicKey = this.keysService.getPublicJwks().keys[0];
    const now = Math.floor(Date.now() / 1000);
    const contentItems = [
      {
        type: "ltiResourceLink",
        title: "Accessible Onboarding",
        url: session.targetLinkUri,
      },
    ];
    const deepLinkToken = await new SignJWT({
      [DEEP_LINKING_MESSAGE_TYPE]: "LtiDeepLinkingResponse",
      [LTI_VERSION_CLAIM]: "1.3.0",
      [LTI_DEPLOYMENT_ID_CLAIM]: session.deploymentId,
      [LTI_DEEP_LINKING_CONTENT_ITEMS_CLAIM]: contentItems,
      ...(session.deepLinkData
        ? { [LTI_DEEP_LINKING_DATA_CLAIM]: session.deepLinkData }
        : {}),
      nonce: randomBytes(32).toString("base64url"),
    })
      .setProtectedHeader({ alg: "RS256", kid: publicKey.kid })
      .setIssuer(platform.clientId)
      .setAudience(platform.issuer)
      .setIssuedAt(now)
      .setExpirationTime(now + 5 * 60)
      .sign(this.keysService.getSigningKey());

    return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Return to your learning platform</title></head>
  <body>
    <main>
      <h1>Activity ready to add</h1>
      <p>Continue to your learning platform to finish adding this activity.</p>
      <form method="post" action="${this.escapeHtml(returnUrl.toString())}">
        <input type="hidden" name="JWT" value="${this.escapeHtml(deepLinkToken)}">
        <button type="submit">Return to your learning platform</button>
      </form>
    </main>
  </body>
</html>`;
  }

  private async verifySession(
    authorization: string | undefined,
  ): Promise<TrustedLtiSession> {
    const match = /^Bearer ([A-Za-z0-9._-]{1,32768})$/.exec(authorization || "");
    if (!match) {
      throw new LtiRequestException(401, "LTI_BAD_AUDIENCE");
    }

    const baseUrl = this.getToolBaseUrl();
    let payload;
    try {
      const publicJwk = this.keysService.getPublicJwks().keys[0];
      ({ payload } = await jwtVerify(
        match[1],
        await importJWK(publicJwk, "RS256"),
        {
          issuer: baseUrl,
          audience: baseUrl,
          algorithms: ["RS256"],
          clockTolerance: 60,
        },
      ));
    } catch {
      throw new LtiRequestException(401, "LTI_BAD_SIGNATURE");
    }

    const session = this.asRecord(payload);
    if (
      !session ||
      session.scope !== "lti:launch" ||
      typeof session.sub !== "string" ||
      !session.sub ||
      (session.role !== "Learner" && session.role !== "Instructor") ||
      typeof session.contextId !== "string" ||
      !session.contextId ||
      typeof session.platformIssuer !== "string" ||
      typeof session.platformClientId !== "string" ||
      typeof session.deploymentId !== "string" ||
      (session.messageType !== "LtiResourceLinkRequest" &&
        session.messageType !== "LtiDeepLinkingRequest") ||
      typeof session.targetLinkUri !== "string"
    ) {
      throw new LtiRequestException(401, "LTI_BAD_AUDIENCE");
    }
    if (
      session.agsScopes !== undefined &&
      (!Array.isArray(session.agsScopes) ||
        !session.agsScopes.every((scope) => typeof scope === "string"))
    ) {
      throw new LtiRequestException(401, "LTI_BAD_AUDIENCE");
    }
    if (
      (session.agsLineItem !== undefined &&
        typeof session.agsLineItem !== "string") ||
      (session.nrpsUrl !== undefined && typeof session.nrpsUrl !== "string") ||
      (session.deepLinkReturnUrl !== undefined &&
        typeof session.deepLinkReturnUrl !== "string") ||
      (session.deepLinkData !== undefined &&
        typeof session.deepLinkData !== "string")
    ) {
      throw new LtiRequestException(401, "LTI_BAD_AUDIENCE");
    }

    return {
      sub: session.sub,
      role: session.role,
      contextId: session.contextId,
      platformIssuer: session.platformIssuer,
      platformClientId: session.platformClientId,
      deploymentId: session.deploymentId,
      messageType: session.messageType,
      targetLinkUri: session.targetLinkUri,
      ...(typeof session.agsLineItem === "string"
        ? { agsLineItem: session.agsLineItem }
        : {}),
      ...(Array.isArray(session.agsScopes)
        ? {
            agsScopes: session.agsScopes.filter(
              (scope): scope is string => typeof scope === "string",
            ),
          }
        : {}),
      ...(typeof session.nrpsUrl === "string" ? { nrpsUrl: session.nrpsUrl } : {}),
      ...(typeof session.deepLinkReturnUrl === "string"
        ? { deepLinkReturnUrl: session.deepLinkReturnUrl }
        : {}),
      ...(typeof session.deepLinkData === "string"
        ? { deepLinkData: session.deepLinkData }
        : {}),
    };
  }

  private getPlatform(session: TrustedLtiSession): PlatformRegistration {
    const platform = this.platformRegistry.find(
      session.platformIssuer,
      session.platformClientId,
    );
    if (!platform) {
      throw new LtiRequestException(401, "LTI_BAD_AUDIENCE");
    }
    return platform;
  }

  private async getPlatformAccessToken(
    platform: PlatformRegistration,
    scope: string,
  ): Promise<string> {
    if (!platform.tokenEndpoint || !this.isSafeServiceUrl(platform.tokenEndpoint)) {
      throw new LtiRequestException(503, "REQUIRED");
    }

    const now = Math.floor(Date.now() / 1000);
    const publicKey = this.keysService.getPublicJwks().keys[0];
    const assertion = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: publicKey.kid })
      .setIssuer(platform.clientId)
      .setSubject(platform.clientId)
      .setAudience(platform.tokenEndpoint)
      .setJti(randomBytes(32).toString("base64url"))
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .sign(this.keysService.getSigningKey());
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_assertion_type: CLIENT_ASSERTION_TYPE,
      client_assertion: assertion,
      scope,
    });
    const response = await this.fetchService(platform.tokenEndpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!response.ok) {
      throw new LtiRequestException(502, "REQUIRED");
    }

    const result = this.asRecord(await this.readJson(response));
    const accessToken = result?.access_token;
    const tokenType = result?.token_type;
    const returnedScope = result?.scope;
    if (
      !result ||
      typeof accessToken !== "string" ||
      !accessToken ||
      typeof tokenType !== "string" ||
      tokenType.toLowerCase() !== "bearer" ||
      (typeof returnedScope === "string" &&
        !returnedScope.split(/\s+/).includes(scope))
    ) {
      throw new LtiRequestException(502, "REQUIRED");
    }
    return accessToken;
  }

  private async fetchService(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    if (!this.isSafeServiceUrl(url)) {
      throw new LtiRequestException(502, "REQUIRED");
    }
    try {
      return await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(SERVICE_TIMEOUT_MS),
      });
    } catch {
      throw new LtiRequestException(502, "REQUIRED");
    }
  }

  private async readJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      throw new LtiRequestException(502, "REQUIRED");
    }
  }

  private getToolBaseUrl(): string {
    const value = process.env.LTI_TOOL_BASE_URL;
    if (!value) {
      throw new LtiRequestException(503, "REQUIRED");
    }
    try {
      const url = new URL(value);
      if (
        (url.protocol !== "https:" &&
          !(
            process.env.NODE_ENV !== "production" &&
            url.protocol === "http:" &&
            ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
          )) ||
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash
      ) {
        throw new Error("Unsafe tool URL");
      }
      return url.origin;
    } catch {
      throw new LtiRequestException(503, "REQUIRED");
    }
  }

  private isSafeServiceUrl(value: string): boolean {
    try {
      const url = new URL(value);
      const localHttp =
        process.env.NODE_ENV !== "production" &&
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      return (
        (url.protocol === "https:" || localHttp) &&
        !url.username &&
        !url.password &&
        !url.hash
      );
    } catch {
      return false;
    }
  }

  private getScoreUrl(lineItemUrl: string): string {
    if (!this.isSafeServiceUrl(lineItemUrl)) {
      throw new LtiRequestException(401, "LTI_BAD_AUDIENCE");
    }
    const normalized = lineItemUrl.endsWith("/") ? lineItemUrl : `${lineItemUrl}/`;
    return new URL("scores", normalized).toString();
  }

  private completionKey(session: {
    platformIssuer: string;
    contextId: string;
    sub: string;
  }): string {
    return JSON.stringify([session.platformIssuer, session.contextId, session.sub]);
  }

  private validateGradeSubmission(
    value: unknown,
    session: TrustedLtiSession,
  ): void {
    if (value === undefined || value === null) {
      return;
    }
    const submission = this.asRecord(value);
    if (
      !submission ||
      submission.sessionId !== session.contextId ||
      submission.userId !== session.sub ||
      submission.scoreGiven !== 1 ||
      submission.scoreMaximum !== 1 ||
      submission.activityProgress !== "Completed" ||
      submission.gradingProgress !== "FullyGraded"
    ) {
      throw new LtiRequestException(422, "REQUIRED");
    }
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
      const entities: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return entities[character];
    });
  }

  private asRecord(value: unknown): Record<string, unknown> | undefined {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return undefined;
    }
    return value as Record<string, unknown>;
  }
}
