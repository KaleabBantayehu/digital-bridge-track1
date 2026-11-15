import { Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { createHash, generateKeyPairSync, KeyObject } from "node:crypto";
import { exportJWK, JWK, SignJWT } from "jose";
import { JsonWebKeySet } from "./keys.service";
import { PlatformRegistration, PlatformRegistry } from "./platform.registry";

const CLIENT_ID = "digital-bridge-mock-platform";
const DEPLOYMENT_ID = "mock-deployment";
const MESSAGE_TYPE = "https://purl.imsglobal.org/spec/lti/claim/message_type";
const VERSION = "https://purl.imsglobal.org/spec/lti/claim/version";
const DEPLOYMENT = "https://purl.imsglobal.org/spec/lti/claim/deployment_id";
const ROLES = "https://purl.imsglobal.org/spec/lti/claim/roles";
const CONTEXT = "https://purl.imsglobal.org/spec/lti/claim/context";
const RESOURCE_LINK = "https://purl.imsglobal.org/spec/lti/claim/resource_link";

@Injectable()
export class MockPlatformService implements OnModuleInit {
  private readonly enabled = process.env.LTI_MOCK_PLATFORM_ENABLED === "true";
  private privateKey: KeyObject | undefined;
  private publicJwk: JWK | undefined;
  private registration: PlatformRegistration | undefined;

  constructor(private readonly platformRegistry: PlatformRegistry) {}

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      return;
    }
    if (process.env.NODE_ENV === "production") {
      throw new Error("The LTI mock platform must not be enabled in production.");
    }

    const toolBaseUrl = process.env.LTI_TOOL_BASE_URL;
    if (!toolBaseUrl) {
      throw new Error("LTI_TOOL_BASE_URL is required when the LTI mock platform is enabled.");
    }
    const base = new URL(toolBaseUrl);
    if (base.pathname !== "/" || base.search || base.hash || base.username || base.password) {
      throw new Error("LTI_TOOL_BASE_URL must be an origin for the LTI mock platform.");
    }

    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const jwk = await exportJWK(publicKey);
    const keyId = createHash("sha256")
      .update(publicKey.export({ format: "der", type: "spki" }))
      .digest("base64url")
      .slice(0, 22);
    this.privateKey = privateKey;
    this.publicJwk = {
      ...jwk,
      alg: "RS256",
      use: "sig",
      key_ops: ["verify"],
      kid: keyId,
    };

    this.registration = {
      issuer: new URL("/api/v1/lti/mock-platform/issuer", base).toString(),
      clientId: CLIENT_ID,
      authorizationEndpoint: new URL(
        "/api/v1/lti/mock-platform/authorize",
        base,
      ).toString(),
      jwksUrl: new URL("/api/v1/lti/mock-platform/jwks", base).toString(),
      deploymentIds: [DEPLOYMENT_ID],
    };

    const existing = this.platformRegistry.find(
      this.registration.issuer,
      this.registration.clientId,
    );
    if (!existing) {
      this.platformRegistry.register(this.registration);
    } else if (
      existing.authorizationEndpoint !== this.registration.authorizationEndpoint ||
      existing.jwksUrl !== this.registration.jwksUrl ||
      existing.deploymentIds.join("\0") !== DEPLOYMENT_ID
    ) {
      throw new Error("The configured mock platform registration does not match its signing key.");
    }
  }

  getPublicJwks(): JsonWebKeySet {
    this.assertEnabled();
    return { keys: [{ ...this.publicJwk! }] };
  }

  async signLaunch(value: unknown): Promise<{ id_token: string; state?: string }> {
    this.assertEnabled();
    const input = this.asRecord(value) ?? {};
    const nonce = input.nonce;
    const role = input.role ?? "Learner";
    if (
      typeof nonce !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(nonce) ||
      (role !== "Learner" && role !== "Instructor") ||
      (input.tampered !== undefined && typeof input.tampered !== "boolean") ||
      (input.expired !== undefined && typeof input.expired !== "boolean") ||
      (input.state !== undefined &&
        (typeof input.state !== "string" || input.state.length > 256))
    ) {
      throw new Error("A valid nonce and launch options are required.");
    }

    const now = Math.floor(Date.now() / 1000);
    const name = role === "Instructor" ? "Mock Instructor" : "Mock Learner";
    let token = await new SignJWT({
      nonce,
      name,
      given_name: role === "Instructor" ? "Mock" : "Mock",
      family_name: role,
      email: `mock-${role.toLowerCase()}@example.test`,
      locale: "en",
      [MESSAGE_TYPE]: "LtiResourceLinkRequest",
      [VERSION]: "1.3.0",
      [DEPLOYMENT]: DEPLOYMENT_ID,
      [ROLES]: [
        `http://purl.imsglobal.org/vocab/lis/v2/membership#${role}`,
      ],
      [CONTEXT]: { id: "mock-course-001", label: "Demo course" },
      [RESOURCE_LINK]: { id: "mock-resource-001", title: "Onboarding" },
    })
      .setProtectedHeader({ alg: "RS256", kid: this.publicJwk!.kid })
      .setIssuer(this.registration!.issuer)
      .setSubject(`mock-${role.toLowerCase()}-001`)
      .setAudience(CLIENT_ID)
      .setIssuedAt(now)
      .setExpirationTime(input.expired === true ? now - 60 : now + 300)
      .sign(this.privateKey!);

    if (input.tampered === true) {
      const parts = token.split(".");
      const signature = Buffer.from(parts[2], "base64url");
      signature[0] ^= 1;
      parts[2] = signature.toString("base64url");
      token = parts.join(".");
    }

    return {
      id_token: token,
      ...(typeof input.state === "string" ? { state: input.state } : {}),
    };
  }

  private assertEnabled(): void {
    if (!this.enabled || !this.privateKey || !this.publicJwk || !this.registration) {
      throw new NotFoundException();
    }
  }

  private asRecord(value: unknown): Record<string, unknown> | undefined {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return undefined;
    }
    return value as Record<string, unknown>;
  }
}
