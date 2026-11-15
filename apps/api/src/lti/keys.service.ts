import { Injectable, OnModuleInit } from "@nestjs/common";
import { createPrivateKey } from "node:crypto";
import {
  calculateJwkThumbprint,
  exportJWK,
  generateKeyPair,
  importPKCS8,
  JWK,
  KeyLike,
} from "jose";

export interface JsonWebKeySet {
  keys: JWK[];
}

@Injectable()
export class KeysService implements OnModuleInit {
  private privateKey: KeyLike | undefined;
  private publicJwk: JWK | undefined;

  async onModuleInit(): Promise<void> {
    if (this.privateKey && this.publicJwk) {
      return;
    }

    const configuredPrivateKey = process.env.LTI_TOOL_PRIVATE_KEY_PEM;
    if (configuredPrivateKey) {
      await this.initializeConfiguredKey(configuredPrivateKey);
      return;
    }

    if (process.env.NODE_ENV === "production") {
      throw new Error("LTI_TOOL_PRIVATE_KEY_PEM must be configured in production.");
    }

    const { privateKey, publicKey } = await generateKeyPair("RS256", {
      modulusLength: 2048,
    });
    const publicJwk = await exportJWK(publicKey);

    this.privateKey = privateKey;
    this.publicJwk = await this.preparePublicJwk(publicJwk);
  }

  getSigningKey(): KeyLike {
    if (!this.privateKey) {
      throw new Error("LTI signing key is not ready.");
    }
    return this.privateKey;
  }

  getPublicJwks(): JsonWebKeySet {
    if (!this.publicJwk) {
      throw new Error("LTI public keys are not ready.");
    }
    return { keys: [{ ...this.publicJwk }] };
  }

  private async initializeConfiguredKey(pemValue: string): Promise<void> {
    const pem = pemValue.replace(/\\n/g, "\n");
    const parsedKey = createPrivateKey(pem);
    if (
      parsedKey.asymmetricKeyType !== "rsa" ||
      (parsedKey.asymmetricKeyDetails?.modulusLength ?? 0) < 2048
    ) {
      throw new Error("The configured LTI signing key must be RSA with at least 2048 bits.");
    }

    const privateKey = await importPKCS8(pem, "RS256");
    const privateJwk = await exportJWK(privateKey);
    const publicJwk: JWK = { ...privateJwk };
    delete publicJwk.d;
    delete publicJwk.dp;
    delete publicJwk.dq;
    delete publicJwk.p;
    delete publicJwk.q;
    delete publicJwk.qi;

    this.privateKey = privateKey;
    this.publicJwk = await this.preparePublicJwk(publicJwk);
  }

  private async preparePublicJwk(publicJwk: JWK): Promise<JWK> {
    const configuredKeyId = process.env.LTI_TOOL_KEY_ID;
    if (configuredKeyId && !/^[A-Za-z0-9._-]{1,128}$/.test(configuredKeyId)) {
      throw new Error("LTI_TOOL_KEY_ID may contain only letters, numbers, dots, underscores, and hyphens.");
    }

    publicJwk.alg = "RS256";
    publicJwk.use = "sig";
    publicJwk.key_ops = ["verify"];
    publicJwk.kid = configuredKeyId ?? (await calculateJwkThumbprint(publicJwk));
    return publicJwk;
  }
}
