import { HttpException, Injectable } from "@nestjs/common";
import {
  BilingualApiError,
  ERROR_MESSAGES,
  ErrorCode,
} from "@db/shared-schemas";
import {
  createRemoteJWKSet,
  errors,
  SignJWT,
  jwtVerify,
} from "jose";
import { timingSafeEqual } from "node:crypto";
import { KeysService } from "./keys.service";
import { LoginStateStore } from "./login-state.store";
import { NonceStore } from "./nonce.store";
import { PlatformRegistration, PlatformRegistry } from "./platform.registry";

const STATE_COOKIE_NAME = "db_lti_state";
const STATE_COOKIE_PATH = "/api/v1/lti/launch";
const CLOCK_TOLERANCE_SECONDS = 60;
const SESSION_TOKEN_TTL_SECONDS = 15 * 60;
const LTI_MESSAGE_TYPE_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/message_type";
const LTI_VERSION_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/version";
const LTI_DEPLOYMENT_ID_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/deployment_id";
const LTI_ROLES_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/roles";
const LTI_CONTEXT_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/context";

type LtiErrorType = BilingualApiError["error"];

export class LtiRequestException extends HttpException {
  constructor(
    statusCode: number,
    readonly code: ErrorCode,
    fields: BilingualApiError["fields"] = [],
  ) {
    const error: LtiErrorType =
      statusCode === 422
        ? "ValidationError"
        : statusCode >= 500
          ? "InternalError"
          : "LtiLaunchRejected";
    const response: BilingualApiError = {
      statusCode,
      error,
      summary: ERROR_MESSAGES[code],
      fields,
    };
    super(response, statusCode);
  }
}

interface LoginInput {
  issuer: string;
  clientId: string;
  loginHint: string;
  targetLinkUri: string;
  ltiMessageHint?: string;
}

interface ToolConfiguration {
  baseUrl: string;
  targetLinkUris: ReadonlySet<string>;
}

export interface LtiLaunchResult {
  sessionToken: string;
  targetLinkUri: string;
  profile: {
    id: string;
    name?: string;
    role: "Learner" | "Instructor";
    contextId: string;
  };
}

@Injectable()
export class LtiService {
  private readonly remoteJwks = new Map<
    string,
    ReturnType<typeof createRemoteJWKSet>
  >();

  constructor(
    private readonly keysService: KeysService,
    private readonly platformRegistry: PlatformRegistry,
    private readonly nonceStore: NonceStore,
    private readonly loginStateStore: LoginStateStore,
  ) {}

  initiateLogin(value: unknown): { redirectUrl: string; cookieValue: string } {
    const input = this.parseLoginInput(value);
    const platform = this.platformRegistry.find(input.issuer, input.clientId);
    if (!platform) {
      throw new LtiRequestException(401, "LTI_BAD_AUDIENCE");
    }

    const tool = this.getToolConfiguration();
    if (!tool.targetLinkUris.has(input.targetLinkUri)) {
      throw new LtiRequestException(401, "LTI_BAD_AUDIENCE");
    }

    const nonce = this.nonceStore.issue();
    const state = this.loginStateStore.issue({
      nonce,
      issuer: platform.issuer,
      clientId: platform.clientId,
      targetLinkUri: input.targetLinkUri,
    });

    const authorizationUrl = new URL(platform.authorizationEndpoint);
    authorizationUrl.searchParams.set("scope", "openid");
    authorizationUrl.searchParams.set("response_type", "id_token");
    authorizationUrl.searchParams.set("response_mode", "form_post");
    authorizationUrl.searchParams.set("prompt", "none");
    authorizationUrl.searchParams.set("client_id", platform.clientId);
    authorizationUrl.searchParams.set("redirect_uri", this.getLaunchUrl(tool.baseUrl));
    authorizationUrl.searchParams.set("login_hint", input.loginHint);
    authorizationUrl.searchParams.set("state", state.state);
    authorizationUrl.searchParams.set("nonce", nonce);
    if (input.ltiMessageHint) {
      authorizationUrl.searchParams.set("lti_message_hint", input.ltiMessageHint);
    }

    return {
      redirectUrl: authorizationUrl.toString(),
      cookieValue: state.cookieValue,
    };
  }

  async verifyLaunch(
    body: unknown,
    cookieValue: string | undefined,
  ): Promise<LtiLaunchResult> {
    const input = this.asRecord(body);
    const state = typeof input?.state === "string" ? input.state : "";
    const stateResult = this.loginStateStore.consume(state, cookieValue ?? "");
    if (!stateResult.valid) {
      const code = stateResult.reason === "expired" ? "TOKEN_EXPIRED" : "TOKEN_USED";
      throw new LtiRequestException(401, code);
    }

    const context = stateResult.context;
    const platform = this.platformRegistry.find(context.issuer, context.clientId);
    if (!platform) {
      throw new LtiRequestException(401, "LTI_BAD_AUDIENCE");
    }

    const idToken = input?.id_token;
    if (typeof idToken !== "string" || idToken.length < 1 || idToken.length > 32_000) {
      throw new LtiRequestException(401, "LTI_BAD_SIGNATURE");
    }

    let payload;
    try {
      const jwks = this.getRemoteJwks(platform);
      ({ payload } = await jwtVerify(idToken, jwks, {
        issuer: platform.issuer,
        audience: platform.clientId,
        algorithms: ["RS256"],
        clockTolerance: CLOCK_TOLERANCE_SECONDS,
      }));
    } catch (error) {
      throw new LtiRequestException(401, this.getVerificationErrorCode(error));
    }

    if (typeof payload.exp !== "number" || typeof payload.iat !== "number") {
      throw new LtiRequestException(401, "REQUIRED");
    }
    const now = Math.floor(Date.now() / 1000);
    if (
      !Number.isFinite(payload.exp) ||
      !Number.isFinite(payload.iat) ||
      payload.iat > now + CLOCK_TOLERANCE_SECONDS ||
      payload.exp <= payload.iat
    ) {
      throw new LtiRequestException(401, "LTI_EXPIRED");
    }

    const audience = payload.aud;
    if (
      payload.azp !== undefined &&
      payload.azp !== platform.clientId
    ) {
      throw new LtiRequestException(401, "LTI_BAD_AUDIENCE");
    }
    if (Array.isArray(audience) && audience.length > 1 && payload.azp !== platform.clientId) {
      throw new LtiRequestException(401, "LTI_BAD_AUDIENCE");
    }

    if (
      typeof payload.nonce !== "string" ||
      !this.constantTimeStringMatch(context.nonce, payload.nonce) ||
      !this.nonceStore.consume(context.nonce)
    ) {
      throw new LtiRequestException(401, "LTI_BAD_NONCE");
    }

    const claims = this.readLtiClaims(payload, platform);
    const tool = this.getToolConfiguration();
    if (!tool.targetLinkUris.has(context.targetLinkUri)) {
      throw new LtiRequestException(401, "LTI_BAD_AUDIENCE");
    }

    const publicKey = this.keysService.getPublicJwks().keys[0];
    const issuedAt = Math.floor(Date.now() / 1000);
    const sessionToken = await new SignJWT({
      scope: "lti:launch",
      role: claims.role,
      contextId: claims.contextId,
      deploymentId: claims.deploymentId,
    })
      .setProtectedHeader({ alg: "RS256", kid: publicKey.kid })
      .setIssuer(tool.baseUrl)
      .setAudience(tool.baseUrl)
      .setSubject(claims.subject)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + SESSION_TOKEN_TTL_SECONDS)
      .sign(this.keysService.getSigningKey());

    return {
      sessionToken,
      targetLinkUri: context.targetLinkUri,
      profile: {
        id: claims.subject,
        ...(claims.name ? { name: claims.name } : {}),
        role: claims.role,
        contextId: claims.contextId,
      },
    };
  }

  getStateCookieName(): string {
    return STATE_COOKIE_NAME;
  }

  getStateCookiePath(): string {
    return STATE_COOKIE_PATH;
  }

  private parseLoginInput(value: unknown): LoginInput {
    const input = this.asRecord(value);
    const fields: BilingualApiError["fields"] = [];
    const required: Array<[string, string, number]> = [
      ["iss", "issuer", 2_048],
      ["client_id", "clientId", 256],
      ["login_hint", "loginHint", 4_096],
      ["target_link_uri", "targetLinkUri", 2_048],
    ];
    const parsed: Record<string, string> = {};

    for (const [source, target, maxLength] of required) {
      const entry = input?.[source];
      if (typeof entry !== "string" || !entry.trim() || entry.length > maxLength) {
        fields.push({ field: source, code: "REQUIRED", message: ERROR_MESSAGES.REQUIRED });
      } else {
        parsed[target] = entry;
      }
    }

    const messageHint = input?.lti_message_hint;
    if (
      messageHint !== undefined &&
      (typeof messageHint !== "string" || messageHint.length > 4_096)
    ) {
      fields.push({
        field: "lti_message_hint",
        code: "REQUIRED",
        message: ERROR_MESSAGES.REQUIRED,
      });
    }

    if (fields.length > 0) {
      throw new LtiRequestException(422, "REQUIRED", fields);
    }

    return {
      issuer: parsed.issuer,
      clientId: parsed.clientId,
      loginHint: parsed.loginHint,
      targetLinkUri: parsed.targetLinkUri,
      ...(typeof messageHint === "string" ? { ltiMessageHint: messageHint } : {}),
    };
  }

  private readLtiClaims(
    payload: Record<string, unknown>,
    platform: PlatformRegistration,
  ): {
    subject: string;
    name?: string;
    role: "Learner" | "Instructor";
    contextId: string;
    deploymentId: string;
  } {
    const subject = payload.sub;
    const messageType = payload[LTI_MESSAGE_TYPE_CLAIM];
    const version = payload[LTI_VERSION_CLAIM];
    const deploymentId = payload[LTI_DEPLOYMENT_ID_CLAIM];
    const roles = payload[LTI_ROLES_CLAIM];
    const context = this.asRecord(payload[LTI_CONTEXT_CLAIM]);

    if (
      typeof subject !== "string" ||
      !subject ||
      messageType !== "LtiResourceLinkRequest" ||
      version !== "1.3.0" ||
      typeof deploymentId !== "string" ||
      !Array.isArray(roles) ||
      !roles.length ||
      !roles.every((role) => typeof role === "string") ||
      typeof context?.id !== "string" ||
      !context.id
    ) {
      throw new LtiRequestException(401, "REQUIRED");
    }
    if (!platform.deploymentIds.includes(deploymentId)) {
      throw new LtiRequestException(401, "LTI_BAD_AUDIENCE");
    }

    const learner = roles.some((role) => (role as string).endsWith("#Learner"));
    const instructor = roles.some((role) => (role as string).endsWith("#Instructor"));
    if (!learner && !instructor) {
      throw new LtiRequestException(401, "REQUIRED");
    }

    return {
      subject,
      ...(typeof payload.name === "string" ? { name: payload.name } : {}),
      role: instructor ? "Instructor" : "Learner",
      contextId: context.id,
      deploymentId,
    };
  }

  private getRemoteJwks(platform: PlatformRegistration): ReturnType<typeof createRemoteJWKSet> {
    const key = JSON.stringify([platform.issuer, platform.clientId]);
    const cached = this.remoteJwks.get(key);
    if (cached) {
      return cached;
    }

    const resolver = createRemoteJWKSet(new URL(platform.jwksUrl), {
      timeoutDuration: 5_000,
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60 * 1000,
    });
    this.remoteJwks.set(key, resolver);
    return resolver;
  }

  private getVerificationErrorCode(error: unknown): ErrorCode {
    if (error instanceof errors.JWTExpired) {
      return "LTI_EXPIRED";
    }
    if (error instanceof errors.JWTClaimValidationFailed) {
      if (error.claim === "iss" || error.claim === "aud" || error.claim === "azp") {
        return "LTI_BAD_AUDIENCE";
      }
      if (error.claim === "exp" || error.claim === "iat" || error.claim === "nbf") {
        return "LTI_EXPIRED";
      }
    }
    return "LTI_BAD_SIGNATURE";
  }

  private getToolConfiguration(): ToolConfiguration {
    const baseUrl = process.env.LTI_TOOL_BASE_URL;
    const targetLinkUrisJson = process.env.LTI_TOOL_TARGET_LINK_URIS;
    if (!baseUrl || !targetLinkUrisJson) {
      throw new LtiRequestException(500, "REQUIRED");
    }

    const base = this.parseConfiguredUrl(baseUrl);
    if (base.pathname !== "/" || base.search || base.hash) {
      throw new LtiRequestException(500, "REQUIRED");
    }

    let targetLinkUris: unknown;
    try {
      targetLinkUris = JSON.parse(targetLinkUrisJson);
    } catch {
      throw new LtiRequestException(500, "REQUIRED");
    }
    if (
      !Array.isArray(targetLinkUris) ||
      targetLinkUris.length === 0 ||
      !targetLinkUris.every(
        (uri) => typeof uri === "string" && this.isSafeConfiguredUrl(uri),
      )
    ) {
      throw new LtiRequestException(500, "REQUIRED");
    }

    return {
      baseUrl: base.origin,
      targetLinkUris: new Set(targetLinkUris),
    };
  }

  private getLaunchUrl(baseUrl: string): string {
    return new URL("/api/v1/lti/launch", baseUrl).toString();
  }

  private parseConfiguredUrl(value: string): URL {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new LtiRequestException(500, "REQUIRED");
    }

    if (!this.isSafeUrl(url)) {
      throw new LtiRequestException(500, "REQUIRED");
    }
    return url;
  }

  private isSafeConfiguredUrl(value: string): boolean {
    try {
      return this.isSafeUrl(new URL(value));
    } catch {
      return false;
    }
  }

  private isSafeUrl(url: URL): boolean {
    const loopbackHosts = ["localhost", "127.0.0.1", "[::1]"];
    const isLocalHttp =
      process.env.NODE_ENV !== "production" &&
      url.protocol === "http:" &&
      loopbackHosts.includes(url.hostname);
    return (
      (url.protocol === "https:" || isLocalHttp) &&
      !url.username &&
      !url.password &&
      !url.hash
    );
  }

  private constantTimeStringMatch(left: string, right: string): boolean {
    const leftBytes = Buffer.from(left, "utf8");
    const rightBytes = Buffer.from(right, "utf8");
    return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
  }

  private asRecord(value: unknown): Record<string, unknown> | undefined {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return undefined;
    }
    return value as Record<string, unknown>;
  }
}
