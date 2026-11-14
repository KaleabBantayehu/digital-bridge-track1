import { Inject, Injectable } from "@nestjs/common";

export const LTI_PLATFORMS_CONFIG = Symbol("LTI_PLATFORMS_CONFIG");

export interface PlatformRegistration {
  readonly issuer: string;
  readonly clientId: string;
  readonly authorizationEndpoint: string;
  readonly jwksUrl: string;
  readonly deploymentIds: readonly string[];
  readonly tokenEndpoint?: string;
}

@Injectable()
export class PlatformRegistry {
  private readonly platforms = new Map<string, PlatformRegistration>();

  constructor(
    @Inject(LTI_PLATFORMS_CONFIG)
    configJson: string | undefined = undefined,
  ) {
    if (configJson !== undefined) {
      this.loadConfiguration(configJson);
    }
  }

  register(platform: PlatformRegistration): void {
    this.addPlatform(platform);
  }

  private addPlatform(value: unknown): void {
    const validatedPlatform = this.validatePlatform(value);

    const key = this.getKey(validatedPlatform.issuer, validatedPlatform.clientId);
    if (this.platforms.has(key)) {
      throw new Error("This issuer and client ID are already registered.");
    }

    this.platforms.set(key, validatedPlatform);
  }

  find(issuer: string, clientId: string): PlatformRegistration | undefined {
    return this.platforms.get(this.getKey(issuer, clientId));
  }

  private loadConfiguration(configJson: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(configJson);
    } catch {
      throw new Error("LTI_PLATFORMS_JSON must contain a valid JSON array.");
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("LTI_PLATFORMS_JSON must contain at least one platform.");
    }

    for (const platform of parsed) {
      this.addPlatform(platform);
    }
  }

  private validatePlatform(value: unknown): PlatformRegistration {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error("Each LTI platform registration must be an object.");
    }

    const platform = value as Record<string, unknown>;
    const allowedKeys = new Set([
      "issuer",
      "clientId",
      "authorizationEndpoint",
      "jwksUrl",
      "deploymentIds",
      "tokenEndpoint",
    ]);
    if (Object.keys(platform).some((key) => !allowedKeys.has(key))) {
      throw new Error("An LTI platform registration contains an unsupported field.");
    }

    const requiredStringFields = [
      "issuer",
      "clientId",
      "authorizationEndpoint",
      "jwksUrl",
    ] as const;
    for (const field of requiredStringFields) {
      if (typeof platform[field] !== "string" || !platform[field].trim()) {
        throw new Error(`LTI platform ${field} must be a non-empty string.`);
      }
    }

    if (
      !Array.isArray(platform.deploymentIds) ||
      platform.deploymentIds.length === 0 ||
      !platform.deploymentIds.every(
        (deploymentId) => typeof deploymentId === "string" && deploymentId.trim().length > 0,
      )
    ) {
      throw new Error("LTI platform deploymentIds must contain at least one non-empty string.");
    }

    if (platform.tokenEndpoint !== undefined && typeof platform.tokenEndpoint !== "string") {
      throw new Error("LTI platform tokenEndpoint must be a string when provided.");
    }

    const validated: PlatformRegistration = {
      issuer: platform.issuer as string,
      clientId: platform.clientId as string,
      authorizationEndpoint: platform.authorizationEndpoint as string,
      jwksUrl: platform.jwksUrl as string,
      deploymentIds: Object.freeze([...(platform.deploymentIds as string[])]),
      ...(platform.tokenEndpoint === undefined
        ? {}
        : { tokenEndpoint: platform.tokenEndpoint as string }),
    };

    this.validateSecureUrl(validated.issuer, "issuer");
    this.validateSecureUrl(validated.authorizationEndpoint, "authorization endpoint");
    this.validateSecureUrl(validated.jwksUrl, "JWKS URL");
    if (validated.tokenEndpoint) {
      this.validateSecureUrl(validated.tokenEndpoint, "token endpoint");
    }

    return Object.freeze(validated);
  }

  private getKey(issuer: string, clientId: string): string {
    return JSON.stringify([issuer, clientId]);
  }

  private validateSecureUrl(value: string, name: string): void {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`The platform ${name} must be an absolute URL.`);
    }

    const loopbackHosts = ["localhost", "127.0.0.1", "[::1]"];
    const isLocalHttp =
      process.env.NODE_ENV !== "production" &&
      url.protocol === "http:" &&
      loopbackHosts.includes(url.hostname);
    if (url.protocol !== "https:" && !isLocalHttp) {
      throw new Error(`The platform ${name} must use HTTPS, except for local development.`);
    }
    if (url.username || url.password || url.hash) {
      throw new Error(`The platform ${name} must not contain credentials or a fragment.`);
    }
  }
}
