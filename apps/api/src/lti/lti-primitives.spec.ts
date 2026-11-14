import * as assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateJwkThumbprint,
  exportPKCS8,
  generateKeyPair,
  importJWK,
  jwtVerify,
  SignJWT,
} from "jose";
import { KeysService } from "./keys.service";
import { LOGIN_STATE_TTL_MS, LoginStateStore } from "./login-state.store";
import { NONCE_TTL_MS, NonceStore } from "./nonce.store";
import { PlatformRegistry, PlatformRegistration } from "./platform.registry";

async function withEnvironment(
  values: Record<string, string | undefined>,
  run: () => Promise<void>,
): Promise<void> {
  const previousValues = new Map<string, string | undefined>();
  for (const [name, value] of Object.entries(values)) {
    previousValues.set(name, process.env[name]);
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }

  try {
    await run();
  } finally {
    for (const [name, value] of previousValues) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
}

test("LTI keys expose only a verifiable public key", async () => {
  await withEnvironment(
    {
      NODE_ENV: "test",
      LTI_TOOL_PRIVATE_KEY_PEM: undefined,
      LTI_TOOL_KEY_ID: undefined,
    },
    async () => {
      const keys = new KeysService();
      await keys.onModuleInit();

      const publicJwk = keys.getPublicJwks().keys[0];
      assert.equal(publicJwk.alg, "RS256");
      assert.equal(publicJwk.use, "sig");
      assert.ok(publicJwk.kid);
      for (const privateParameter of ["d", "dp", "dq", "p", "q", "qi"]) {
        assert.equal(privateParameter in publicJwk, false);
      }

      const token = await new SignJWT({ purpose: "test" })
        .setProtectedHeader({ alg: "RS256", kid: publicJwk.kid })
        .setIssuedAt()
        .setExpirationTime("1m")
        .sign(keys.getSigningKey());
      const importedPublicKey = await importJWK(publicJwk, "RS256");
      const verified = await jwtVerify(token, importedPublicKey, {
        algorithms: ["RS256"],
      });
      assert.equal(verified.payload.purpose, "test");
    },
  );
});

test("production requires a configured private signing key", async () => {
  await withEnvironment(
    {
      NODE_ENV: "production",
      LTI_TOOL_PRIVATE_KEY_PEM: undefined,
      LTI_TOOL_KEY_ID: undefined,
    },
    async () => {
      await assert.rejects(
        () => new KeysService().onModuleInit(),
        /LTI_TOOL_PRIVATE_KEY_PEM must be configured/,
      );
    },
  );
});

test("production uses the configured key and stable public key ID", async () => {
  const { privateKey } = await generateKeyPair("RS256", { modulusLength: 2048 });
  const privateKeyPem = await exportPKCS8(privateKey);

  await withEnvironment(
    {
      NODE_ENV: "production",
      LTI_TOOL_PRIVATE_KEY_PEM: privateKeyPem,
      LTI_TOOL_KEY_ID: undefined,
    },
    async () => {
      const service = new KeysService();
      await service.onModuleInit();
      const publicJwk = service.getPublicJwks().keys[0];

      assert.equal(publicJwk.kid, await calculateJwkThumbprint(publicJwk));
      for (const privateParameter of ["d", "dp", "dq", "p", "q", "qi"]) {
        assert.equal(privateParameter in publicJwk, false);
      }
    },
  );
});

test("platform registry matches the exact trusted issuer and client ID", () => {
  const registry = new PlatformRegistry();
  const platform: PlatformRegistration = {
    issuer: "https://lms.example",
    clientId: "digital-bridge",
    authorizationEndpoint: "https://lms.example/authorize",
    jwksUrl: "https://lms.example/jwks",
    deploymentIds: ["deployment-1"],
  };

  registry.register(platform);

  assert.deepEqual(registry.find(platform.issuer, platform.clientId), platform);
  assert.equal(registry.find("https://unknown.example", platform.clientId), undefined);
  assert.equal(registry.find(platform.issuer, "another-client"), undefined);
  assert.throws(() => registry.register(platform), /already registered/);
});

test("platform registry loads and validates JSON configuration", () => {
  const platform: PlatformRegistration = {
    issuer: "https://lms.example",
    clientId: "digital-bridge",
    authorizationEndpoint: "https://lms.example/authorize",
    jwksUrl: "https://lms.example/jwks",
    deploymentIds: ["deployment-1"],
    tokenEndpoint: "https://lms.example/token",
  };
  const registry = new PlatformRegistry(JSON.stringify([platform]));

  assert.deepEqual(registry.find(platform.issuer, platform.clientId), platform);
  assert.throws(() => new PlatformRegistry("{invalid"), /valid JSON array/);
  assert.throws(() => new PlatformRegistry("[]"), /at least one platform/);
});

test("platform registry rejects non-HTTPS URLs outside local development", () => {
  const registry = new PlatformRegistry();
  assert.throws(
    () =>
      registry.register({
        issuer: "http://lms.example",
        clientId: "digital-bridge",
        authorizationEndpoint: "https://lms.example/authorize",
        jwksUrl: "https://lms.example/jwks",
        deploymentIds: ["deployment-1"],
      }),
    /must use HTTPS/,
  );
});

test("platform registry rejects local HTTP URLs in production", async () => {
  await withEnvironment({ NODE_ENV: "production" }, async () => {
    const registry = new PlatformRegistry();
    assert.throws(
      () =>
        registry.register({
          issuer: "http://localhost:9000",
          clientId: "digital-bridge",
          authorizationEndpoint: "http://localhost:9000/authorize",
          jwksUrl: "http://localhost:9000/jwks",
          deploymentIds: ["deployment-1"],
        }),
      /must use HTTPS/,
    );
  });
});

test("nonce values expire after five minutes and can be consumed only once", () => {
  let now = 1_000;
  const store = new NonceStore(() => now);
  const nonce = store.issue();

  assert.equal(store.consume(nonce), true);
  assert.equal(store.consume(nonce), false);

  const expiringNonce = store.issue();
  now += NONCE_TTL_MS;
  assert.equal(store.consume(expiringNonce), false);
});

test("login state is cookie-bound, single-use, and expires after five minutes", () => {
  let now = 1_000;
  const nonceStore = new NonceStore(() => now);
  const stateStore = new LoginStateStore(() => now);
  const nonce = nonceStore.issue();
  const issued = stateStore.issue(nonce);

  assert.equal(stateStore.consume(issued.state, "wrong-cookie"), undefined);
  assert.equal(stateStore.consume(issued.state, issued.cookieValue), nonce);
  assert.equal(stateStore.consume(issued.state, issued.cookieValue), undefined);

  const expiring = stateStore.issue(nonceStore.issue());
  now += LOGIN_STATE_TTL_MS;
  assert.equal(stateStore.consume(expiring.state, expiring.cookieValue), undefined);
});

test("login state refuses a nonce without sufficient random-token shape", () => {
  const stateStore = new LoginStateStore(() => 1_000);
  assert.throws(() => stateStore.issue("predictable"), /32-byte base64url/);
});
