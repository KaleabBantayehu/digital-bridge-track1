import * as assert from "node:assert/strict";
import { createServer, Server } from "node:http";
import { test } from "node:test";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import {
  importJWK,
  jwtVerify,
  SignJWT,
} from "jose";
import { KeysService } from "./keys.service";
import { LoginStateStore } from "./login-state.store";
import { LtiRequestException, LtiService } from "./lti.service";
import { LtiModule } from "./lti.module";
import { NonceStore } from "./nonce.store";
import { PlatformRegistry, PlatformRegistration } from "./platform.registry";

const MESSAGE_TYPE = "https://purl.imsglobal.org/spec/lti/claim/message_type";
const VERSION = "https://purl.imsglobal.org/spec/lti/claim/version";
const DEPLOYMENT_ID = "https://purl.imsglobal.org/spec/lti/claim/deployment_id";
const ROLES = "https://purl.imsglobal.org/spec/lti/claim/roles";
const CONTEXT = "https://purl.imsglobal.org/spec/lti/claim/context";
const TARGET_LINK_URI = "http://localhost:5173/standalone.html";

interface LoginTransaction {
  state: string;
  nonce: string;
  cookieValue: string;
}

interface TestHarness {
  service: LtiService;
  toolKeys: KeysService;
  platformKeys: KeysService;
  platform: PlatformRegistration;
  server: Server;
}

async function withEnvironment(run: () => Promise<void>): Promise<void> {
  const names = [
    "NODE_ENV",
    "LTI_TOOL_BASE_URL",
    "LTI_TOOL_TARGET_LINK_URIS",
    "LTI_PLATFORMS_JSON",
    "LTI_TOOL_PRIVATE_KEY_PEM",
    "LTI_TOOL_KEY_ID",
  ];
  const previous = new Map(names.map((name) => [name, process.env[name]]));
  process.env.NODE_ENV = "test";
  process.env.LTI_TOOL_BASE_URL = "http://localhost:3000";
  process.env.LTI_TOOL_TARGET_LINK_URIS = JSON.stringify([TARGET_LINK_URI]);
  delete process.env.LTI_TOOL_PRIVATE_KEY_PEM;
  delete process.env.LTI_TOOL_KEY_ID;

  try {
    await run();
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
}

async function createHarness(): Promise<TestHarness> {
  const platformKeys = new KeysService();
  const toolKeys = new KeysService();
  await platformKeys.onModuleInit();
  await toolKeys.onModuleInit();
  const platformJwks = { keys: platformKeys.getPublicJwks().keys };

  const server = createServer((request, response) => {
    if (request.url !== "/jwks") {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(platformJwks));
  });
  const port = await new Promise<number>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Local platform test server did not receive a TCP address."));
        return;
      }
      resolve(address.port);
    });
  });

  const issuer = `http://127.0.0.1:${port}/issuer`;
  const platform: PlatformRegistration = {
    issuer,
    clientId: "digital-bridge-test",
    authorizationEndpoint: `http://127.0.0.1:${port}/authorize`,
    jwksUrl: `http://127.0.0.1:${port}/jwks`,
    deploymentIds: ["deployment-test"],
  };
  const registry = new PlatformRegistry();
  registry.register(platform);

  const service = new LtiService(
    toolKeys,
    registry,
    new NonceStore(() => Date.now()),
    new LoginStateStore(() => Date.now()),
  );
  return { service, toolKeys, platformKeys, platform, server };
}

async function createHttpHarness(): Promise<
  TestHarness & { apiBaseUrl: string; close: () => Promise<void> }
> {
  const platformKeys = new KeysService();
  await platformKeys.onModuleInit();
  const platformJwks = { keys: platformKeys.getPublicJwks().keys };
  const server = createServer((request, response) => {
    if (request.url !== "/jwks") {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(platformJwks));
  });
  const port = await new Promise<number>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Local platform test server did not receive a TCP address."));
        return;
      }
      resolve(address.port);
    });
  });

  const platform: PlatformRegistration = {
    issuer: `http://127.0.0.1:${port}/issuer`,
    clientId: "digital-bridge-http-test",
    authorizationEndpoint: `http://127.0.0.1:${port}/authorize`,
    jwksUrl: `http://127.0.0.1:${port}/jwks`,
    deploymentIds: ["deployment-http-test"],
  };
  process.env.LTI_PLATFORMS_JSON = JSON.stringify([platform]);

  const app = await NestFactory.create(LtiModule, { logger: false });
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(0, "127.0.0.1");
  const apiBaseUrl = await app.getUrl();
  process.env.LTI_TOOL_BASE_URL = apiBaseUrl;

  const service = app.get(LtiService);
  const toolKeys = app.get(KeysService);
  const apiServer = app.getHttpServer() as Server;
  return {
    service,
    toolKeys,
    platformKeys,
    platform,
    server,
    apiBaseUrl,
    close: async () => {
      apiServer.closeAllConnections();
      await app.close();
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

function startLogin(harness: TestHarness): LoginTransaction {
  const login = harness.service.initiateLogin({
    iss: harness.platform.issuer,
    client_id: harness.platform.clientId,
    login_hint: "learner@example.test",
    target_link_uri: TARGET_LINK_URI,
    lti_message_hint: "course-launch",
  });
  const authorizationUrl = new URL(login.redirectUrl);
  assert.equal(authorizationUrl.searchParams.get("scope"), "openid");
  assert.equal(authorizationUrl.searchParams.get("response_type"), "id_token");
  assert.equal(authorizationUrl.searchParams.get("response_mode"), "form_post");
  assert.equal(authorizationUrl.searchParams.get("prompt"), "none");
  assert.equal(authorizationUrl.searchParams.get("client_id"), harness.platform.clientId);
  assert.equal(
    authorizationUrl.searchParams.get("redirect_uri"),
    "http://localhost:3000/api/v1/lti/launch",
  );
  assert.equal(authorizationUrl.searchParams.get("login_hint"), "learner@example.test");
  assert.equal(authorizationUrl.searchParams.get("lti_message_hint"), "course-launch");

  const state = authorizationUrl.searchParams.get("state");
  const nonce = authorizationUrl.searchParams.get("nonce");
  assert.ok(state);
  assert.ok(nonce);
  return { state, nonce, cookieValue: login.cookieValue };
}

async function createIdToken(
  harness: TestHarness,
  transaction: LoginTransaction,
  overrides: {
    issuer?: string;
    audience?: string | string[];
    expiresAt?: number;
    issuedAt?: number;
    nonce?: string | null;
    deploymentId?: string;
    omitContext?: boolean;
    roles?: string[];
  } = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = {
    [MESSAGE_TYPE]: "LtiResourceLinkRequest",
    [VERSION]: "1.3.0",
    [DEPLOYMENT_ID]:
      overrides.deploymentId ?? harness.platform.deploymentIds[0],
    [ROLES]:
      overrides.roles ??
      ["http://purl.imsglobal.org/vocab/lis/v2/membership#Learner"],
    ...(overrides.omitContext ? {} : { [CONTEXT]: { id: "course-test" } }),
    name: "Test Learner",
    ...(overrides.nonce === null
      ? {}
      : { nonce: overrides.nonce ?? transaction.nonce }),
  };
  const token = new SignJWT(payload)
    .setProtectedHeader({
      alg: "RS256",
      kid: harness.platformKeys.getPublicJwks().keys[0].kid,
    })
    .setIssuer(overrides.issuer ?? harness.platform.issuer)
    .setSubject("learner-test")
    .setAudience(overrides.audience ?? harness.platform.clientId)
    .setIssuedAt(overrides.issuedAt ?? now)
    .setExpirationTime(overrides.expiresAt ?? now + 300);
  return token.sign(harness.platformKeys.getSigningKey());
}

function assertLtiError(code: string) {
  return (error: unknown): boolean =>
    error instanceof LtiRequestException && error.code === code;
}

test("LTI login and launch verify real signed tokens and reject invalid launches", async (t) => {
  await withEnvironment(async () => {
    const harness = await createHarness();
    t.after(
      () =>
        new Promise<void>((resolve, reject) => {
          harness.server.close((error) => (error ? reject(error) : resolve()));
        }),
    );

    await t.test("valid launch returns a short-lived tool session", async () => {
      const transaction = startLogin(harness);
      const idToken = await createIdToken(harness, transaction);
      const launch = await harness.service.verifyLaunch(
        { id_token: idToken, state: transaction.state },
        transaction.cookieValue,
      );

      assert.equal(launch.profile.id, "learner-test");
      assert.equal(launch.profile.role, "Learner");
      assert.equal(launch.profile.contextId, "course-test");
      assert.equal(launch.targetLinkUri, TARGET_LINK_URI);

      const toolPublicJwk = harness.toolKeys.getPublicJwks().keys[0];
      const verifiedSession = await jwtVerify(
        launch.sessionToken,
        await importJWK(toolPublicJwk, "RS256"),
        {
          issuer: "http://localhost:3000",
          audience: "http://localhost:3000",
          algorithms: ["RS256"],
        },
      );
      assert.equal(verifiedSession.payload.scope, "lti:launch");
      assert.equal(verifiedSession.payload.sub, "learner-test");
      assert.equal(verifiedSession.payload.role, "Learner");
    });

    await t.test("login request rejects an unknown platform", () => {
      assert.throws(
        () =>
          harness.service.initiateLogin({
            iss: "https://unknown.example",
            client_id: harness.platform.clientId,
            login_hint: "learner@example.test",
            target_link_uri: TARGET_LINK_URI,
          }),
        assertLtiError("LTI_BAD_AUDIENCE"),
      );
    });

    await t.test("login request rejects a target URI outside the configured allow-list", () => {
      assert.throws(
        () =>
          harness.service.initiateLogin({
            iss: harness.platform.issuer,
            client_id: harness.platform.clientId,
            login_hint: "learner@example.test",
            target_link_uri: "https://attacker.example/redirect",
          }),
        assertLtiError("LTI_BAD_AUDIENCE"),
      );
    });

    await t.test("launch rejects an incorrect state cookie without consuming the valid state", async () => {
      const transaction = startLogin(harness);
      const idToken = await createIdToken(harness, transaction);
      await assert.rejects(
        () =>
          harness.service.verifyLaunch(
            { id_token: idToken, state: transaction.state },
            "wrong-cookie",
          ),
        assertLtiError("TOKEN_USED"),
      );

      const launch = await harness.service.verifyLaunch(
        { id_token: idToken, state: transaction.state },
        transaction.cookieValue,
      );
      assert.equal(launch.profile.id, "learner-test");
    });

    await t.test("launch rejects a tampered signature", async () => {
      const transaction = startLogin(harness);
      const token = await createIdToken(harness, transaction);
      const parts = token.split(".");
      parts[2] = `${parts[2][0] === "a" ? "b" : "a"}${parts[2].slice(1)}`;

      await assert.rejects(
        () =>
          harness.service.verifyLaunch(
            { id_token: parts.join("."), state: transaction.state },
            transaction.cookieValue,
          ),
        assertLtiError("LTI_BAD_SIGNATURE"),
      );
    });

    await t.test("launch rejects a mismatched issuer or audience", async () => {
      for (const overrides of [
        { issuer: "https://wrong-issuer.example" },
        { audience: "wrong-client" },
      ]) {
        const transaction = startLogin(harness);
        const token = await createIdToken(harness, transaction, overrides);
        await assert.rejects(
          () =>
            harness.service.verifyLaunch(
              { id_token: token, state: transaction.state },
              transaction.cookieValue,
            ),
          assertLtiError("LTI_BAD_AUDIENCE"),
        );
      }
    });

    await t.test("launch rejects an expired token and a future issued-at time", async () => {
      const now = Math.floor(Date.now() / 1000);
      for (const overrides of [
        { expiresAt: now - 120 },
        { issuedAt: now + 120 },
      ]) {
        const transaction = startLogin(harness);
        const token = await createIdToken(harness, transaction, overrides);
        await assert.rejects(
          () =>
            harness.service.verifyLaunch(
              { id_token: token, state: transaction.state },
              transaction.cookieValue,
            ),
          assertLtiError("LTI_EXPIRED"),
        );
      }
    });

    await t.test("launch rejects a missing or incorrect nonce", async () => {
      for (const nonce of [null, "incorrect-nonce"]) {
        const transaction = startLogin(harness);
        const token = await createIdToken(harness, transaction, { nonce });
        await assert.rejects(
          () =>
            harness.service.verifyLaunch(
              { id_token: token, state: transaction.state },
              transaction.cookieValue,
            ),
          assertLtiError("LTI_BAD_NONCE"),
        );
      }
    });

    await t.test("launch rejects a replayed state and nonce", async () => {
      const transaction = startLogin(harness);
      const token = await createIdToken(harness, transaction);
      await harness.service.verifyLaunch(
        { id_token: token, state: transaction.state },
        transaction.cookieValue,
      );

      await assert.rejects(
        () =>
          harness.service.verifyLaunch(
            { id_token: token, state: transaction.state },
            transaction.cookieValue,
          ),
        assertLtiError("TOKEN_USED"),
      );
    });

    await t.test("launch rejects missing required LTI claims and unregistered deployment IDs", async () => {
      const missingContext = startLogin(harness);
      const noContextToken = await createIdToken(harness, missingContext, {
        omitContext: true,
      });
      await assert.rejects(
        () =>
          harness.service.verifyLaunch(
            { id_token: noContextToken, state: missingContext.state },
            missingContext.cookieValue,
          ),
        assertLtiError("REQUIRED"),
      );

      const wrongDeployment = startLogin(harness);
      const wrongDeploymentToken = await createIdToken(harness, wrongDeployment, {
        deploymentId: "unregistered-deployment",
      });
      await assert.rejects(
        () =>
          harness.service.verifyLaunch(
            { id_token: wrongDeploymentToken, state: wrongDeployment.state },
            wrongDeployment.cookieValue,
          ),
        assertLtiError("LTI_BAD_AUDIENCE"),
      );
    });

    await t.test("launch rejects replayed states and missing token data with bilingual errors", async () => {
      const transaction = startLogin(harness);
      await assert.rejects(
        () =>
          harness.service.verifyLaunch(
            { state: transaction.state },
            transaction.cookieValue,
          ),
        (error: unknown) => {
          if (!(error instanceof LtiRequestException)) {
            return false;
          }
          const response = error.getResponse() as {
            statusCode: number;
            error: string;
            summary: { en: string; am: string };
          };
          return (
            error.code === "LTI_BAD_SIGNATURE" &&
            response.statusCode === 401 &&
            response.error === "LtiLaunchRejected" &&
            Boolean(response.summary.en && response.summary.am)
          );
        },
      );
    });
  });
});

test("LTI HTTP routes perform login redirect and real launch verification", async () => {
  await withEnvironment(async () => {
    const harness = await createHttpHarness();
    try {
      const loginParams = new URLSearchParams({
        iss: harness.platform.issuer,
        client_id: harness.platform.clientId,
        login_hint: "learner@example.test",
        target_link_uri: TARGET_LINK_URI,
      });
      const loginResponse = await fetch(
        `${harness.apiBaseUrl}/api/v1/lti/login?${loginParams.toString()}`,
        { redirect: "manual" },
      );
      assert.equal(loginResponse.status, 302);

      const location = loginResponse.headers.get("location");
      const setCookie = loginResponse.headers.get("set-cookie");
      assert.ok(location);
      assert.ok(setCookie);
      const authorizationUrl = new URL(location);
      const cookieMatch = new RegExp(
        `(?:^|;\\s*)${harness.service.getStateCookieName()}=([^;]+)`,
      ).exec(setCookie);
      assert.ok(cookieMatch);

      const transaction: LoginTransaction = {
        state: authorizationUrl.searchParams.get("state") ?? "",
        nonce: authorizationUrl.searchParams.get("nonce") ?? "",
        cookieValue: cookieMatch[1],
      };
      const token = await createIdToken(harness, transaction);
      const launchResponse = await fetch(`${harness.apiBaseUrl}/api/v1/lti/launch`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${harness.service.getStateCookieName()}=${transaction.cookieValue}`,
        },
        body: JSON.stringify({ id_token: token, state: transaction.state }),
      });
      assert.equal(launchResponse.status, 200);
      const launchBody = (await launchResponse.json()) as {
        sessionToken: string;
        profile: { id: string; role: string };
      };
      assert.equal(launchBody.profile.id, "learner-test");
      assert.equal(launchBody.profile.role, "Learner");
      assert.ok(launchBody.sessionToken);

      const nextLogin = await fetch(`${harness.apiBaseUrl}/api/v1/lti/login`, {
        method: "POST",
        redirect: "manual",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          iss: harness.platform.issuer,
          client_id: harness.platform.clientId,
          login_hint: "learner@example.test",
          target_link_uri: TARGET_LINK_URI,
        }),
      });
      assert.equal(nextLogin.status, 302);
      const nextLocation = new URL(nextLogin.headers.get("location") ?? "");
      const nextCookie = nextLogin.headers.get("set-cookie") ?? "";
      const nextCookieMatch = new RegExp(
        `(?:^|;\\s*)${harness.service.getStateCookieName()}=([^;]+)`,
      ).exec(nextCookie);
      assert.ok(nextCookieMatch);

      const invalidTransaction: LoginTransaction = {
        state: nextLocation.searchParams.get("state") ?? "",
        nonce: nextLocation.searchParams.get("nonce") ?? "",
        cookieValue: nextCookieMatch[1],
      };
      const validToken = await createIdToken(harness, invalidTransaction);
      const tokenParts = validToken.split(".");
      tokenParts[2] = `${tokenParts[2][0] === "a" ? "b" : "a"}${tokenParts[2].slice(1)}`;

      const rejectedResponse = await fetch(`${harness.apiBaseUrl}/api/v1/lti/launch`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `${harness.service.getStateCookieName()}=${invalidTransaction.cookieValue}`,
        },
        body: JSON.stringify({
          id_token: tokenParts.join("."),
          state: invalidTransaction.state,
        }),
      });
      assert.equal(rejectedResponse.status, 401);
      const rejectedBody = (await rejectedResponse.json()) as {
        statusCode: number;
        error: string;
        summary: { en: string; am: string };
      };
      assert.equal(rejectedBody.statusCode, 401);
      assert.equal(rejectedBody.error, "LtiLaunchRejected");
      assert.ok(rejectedBody.summary.en && rejectedBody.summary.am);
    } finally {
      await harness.close();
    }
  });
});
