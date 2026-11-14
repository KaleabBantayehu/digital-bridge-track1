import { Inject, Injectable } from "@nestjs/common";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const LOGIN_STATE_STORE_CLOCK = Symbol("LOGIN_STATE_STORE_CLOCK");
export const LOGIN_STATE_TTL_MS = 5 * 60 * 1000;

export interface IssuedLoginState {
  state: string;
  cookieValue: string;
}

export interface LoginStateContext {
  nonce: string;
  issuer: string;
  clientId: string;
  targetLinkUri: string;
}

export type LoginStateConsumption =
  | { valid: true; context: LoginStateContext }
  | { valid: false; reason: "expired" | "invalid" };

interface LoginStateRecord {
  context: LoginStateContext;
  cookieHash: string;
  expiresAt: number;
}

@Injectable()
export class LoginStateStore {
  private readonly pendingStates = new Map<string, LoginStateRecord>();

  constructor(
    @Inject(LOGIN_STATE_STORE_CLOCK)
    private readonly now: () => number,
  ) {}

  issue(context: LoginStateContext): IssuedLoginState {
    if (!/^[A-Za-z0-9_-]{43}$/.test(context.nonce)) {
      throw new Error("An LTI nonce must be a 32-byte base64url value.");
    }
    if (
      !context.issuer.trim() ||
      !context.clientId.trim() ||
      !context.targetLinkUri.trim()
    ) {
      throw new Error("LTI login state requires issuer, client ID, and target link URI.");
    }

    this.removeExpired();
    const state = randomBytes(32).toString("base64url");
    const cookieValue = randomBytes(32).toString("base64url");
    this.pendingStates.set(this.digest(state), {
      context: Object.freeze({ ...context }),
      cookieHash: this.digest(cookieValue),
      expiresAt: this.now() + LOGIN_STATE_TTL_MS,
    });

    return { state, cookieValue };
  }

  consume(state: string, cookieValue: string): LoginStateConsumption {
    if (typeof state !== "string" || !state || typeof cookieValue !== "string" || !cookieValue) {
      return { valid: false, reason: "invalid" };
    }

    const stateKey = this.digest(state);
    const record = this.pendingStates.get(stateKey);
    if (!record) {
      return { valid: false, reason: "invalid" };
    }

    if (record.expiresAt <= this.now()) {
      this.pendingStates.delete(stateKey);
      return { valid: false, reason: "expired" };
    }

    const expectedCookieHash = Buffer.from(record.cookieHash, "base64url");
    const suppliedCookieHash = Buffer.from(this.digest(cookieValue), "base64url");
    if (!timingSafeEqual(expectedCookieHash, suppliedCookieHash)) {
      return { valid: false, reason: "invalid" };
    }

    this.pendingStates.delete(stateKey);
    return { valid: true, context: record.context };
  }

  private digest(value: string): string {
    return createHash("sha256").update(value, "utf8").digest("base64url");
  }

  private removeExpired(): void {
    const now = this.now();
    for (const [stateKey, record] of this.pendingStates) {
      if (record.expiresAt <= now) {
        this.pendingStates.delete(stateKey);
      }
    }
  }
}
