import { Inject, Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";

export const NONCE_STORE_CLOCK = Symbol("NONCE_STORE_CLOCK");
export const NONCE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class NonceStore {
  private readonly expirations = new Map<string, number>();

  constructor(
    @Inject(NONCE_STORE_CLOCK)
    private readonly now: () => number,
  ) {}

  issue(): string {
    this.removeExpired();

    const nonce = randomBytes(32).toString("base64url");
    this.expirations.set(nonce, this.now() + NONCE_TTL_MS);
    return nonce;
  }

  consume(nonce: string): boolean {
    const expiresAt = this.expirations.get(nonce);
    if (expiresAt === undefined) {
      return false;
    }

    this.expirations.delete(nonce);
    return expiresAt > this.now();
  }

  private removeExpired(): void {
    const now = this.now();
    for (const [nonce, expiresAt] of this.expirations) {
      if (expiresAt <= now) {
        this.expirations.delete(nonce);
      }
    }
  }
}
