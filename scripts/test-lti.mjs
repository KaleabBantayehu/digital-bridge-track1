import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { createMockLmsServer } = require("../apps/savanna-host-demo/mock-lms/server.cjs");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = 3099;
const apiBaseUrl = `http://127.0.0.1:${port}`;
const mockLms = createMockLmsServer({
  port: 0,
  host: "127.0.0.1",
  toolBaseUrl: apiBaseUrl,
});
let apiProcess;
let apiOutput = "";
let checkCount = 0;
// Slow laptops can need minutes for the API cold start: LTI_TEST_TIMEOUT_MS raises both limits (defaults unchanged).
const EXTRA_MS = Number(process.env.LTI_TEST_TIMEOUT_MS) || 0;
const deadline = Date.now() + Math.max(90_000, EXTRA_MS + 30_000);

function assertTimeRemaining() {
  const remaining = deadline - Date.now();
  assert.ok(remaining > 0, "LTI verification exceeded its 9-second limit.");
  return Math.min(1_500, remaining);
}

async function request(url, init = {}) {
  const timeout = assertTimeRemaining();
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeout),
    });
  } catch (error) {
    throw new Error(`Request to ${url} failed: ${error.message}`, { cause: error });
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function assertBilingualUnauthorized(status, body) {
  assert.equal(status, 401);
  assert.equal(body.statusCode, 401);
  assert.equal(body.error, "LtiLaunchRejected");
  assert.ok(body.summary?.en);
  assert.ok(body.summary?.am);
}

async function runCheck(name, check) {
  await check();
  checkCount += 1;
  process.stdout.write(`PASS ${checkCount}/8 ${name}\n`);
}

function readCookie(response) {
  const value = response.headers.get("set-cookie") || "";
  const match = /(?:^|;\s*)db_lti_state=([^;]+)/.exec(value);
  assert.ok(match, "Login must set the cookie-bound state value.");
  return match[1];
}

async function launchWithMockLms(mode = "student") {
  const config = mockLms.getConfiguration();
  const loginUrl = new URL("/api/v1/lti/login", apiBaseUrl);
  for (const [key, value] of Object.entries({
    iss: config.issuer,
    client_id: config.clientId,
    login_hint: mode === "teacher" ? "mock-instructor@example.test" : "mock-learner@example.test",
    target_link_uri: config.defaultTargetLinkUri,
    ...(mode === "teacher" ? { lti_message_hint: "mock-teacher" } : {}),
    ...(mode === "deep-link" ? { lti_message_hint: "mock-deep-link" } : {}),
    ...(mode === "tampered" ? { lti_message_hint: "mock-tamper-signature" } : {}),
  })) {
    loginUrl.searchParams.set(key, value);
  }

  const loginResponse = await request(loginUrl, { redirect: "manual" });
  assert.equal(loginResponse.status, 302);
  const authorizationUrl = loginResponse.headers.get("location");
  assert.ok(authorizationUrl);
  const cookie = readCookie(loginResponse);

  const authorizationResponse = await request(authorizationUrl);
  assert.equal(authorizationResponse.status, 200);
  const html = await authorizationResponse.text();
  const token = /name="id_token" value="([^"]+)"/.exec(html)?.[1];
  const state = /name="state" value="([^"]+)"/.exec(html)?.[1];
  assert.ok(token);
  assert.ok(state);

  const launchResponse = await request(`${apiBaseUrl}/api/v1/lti/launch`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: `db_lti_state=${cookie}`,
    },
    body: new URLSearchParams({ id_token: token, state }),
  });
  return {
    response: launchResponse,
    body: await launchResponse.json(),
    token,
    state,
    cookie,
  };
}

async function loginWithApiMockPlatform() {
  const targetLinkUri = `${apiBaseUrl}/standalone.html`;
  const loginResponse = await request(`${apiBaseUrl}/api/v1/lti/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      iss: `${apiBaseUrl}/api/v1/lti/mock-platform/issuer`,
      client_id: "digital-bridge-mock-platform",
      login_hint: "mock-learner@example.test",
      target_link_uri: targetLinkUri,
      redirect: false,
    }),
  });
  assert.equal(loginResponse.status, 200);
  const login = await loginResponse.json();
  assert.ok(login.state && login.nonce && login.authUrl && login.redirectUrl);
  return { ...login, cookie: readCookie(loginResponse) };
}

async function launchWithApiMockPlatform(options = {}) {
  const login = await loginWithApiMockPlatform();
  const signedResponse = await request(
    `${apiBaseUrl}/api/v1/lti/mock-platform/sign-launch`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        state: login.state,
        nonce: login.nonce,
        role: "Learner",
        ...options,
      }),
    },
  );
  assert.equal(signedResponse.status, 201);
  const signed = await signedResponse.json();
  assert.equal(signed.state, login.state);
  const launchResponse = await request(`${apiBaseUrl}/api/v1/lti/launch`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: `db_lti_state=${login.cookie}`,
    },
    body: new URLSearchParams({
      id_token: signed.id_token,
      state: login.state,
    }),
  });
  return { login, signed, response: launchResponse };
}

async function waitForApi() {
  const readyBy = Math.min(deadline, Date.now() + Math.max(60_000, EXTRA_MS));
  const entrypoint = path.join(root, "apps", "api", "dist", "main.js");
  while (Date.now() < readyBy) {
    if (apiProcess.exitCode !== null) {
      throw new Error(`LTI API exited before becoming ready.\n${apiOutput}`);
    }
    try {
      for (const endpoint of ["/api/v1/health", "/api/v1/lti/jwks"]) {
        const response = await request(`${apiBaseUrl}${endpoint}`);
        if (response.ok) {
          return;
        }
      }
    } catch (error) {
      if (Date.now() >= readyBy) {
        throw error;
      }
    }
    await delay(100);
  }
  throw new Error(`LTI API did not become ready in time.\n${apiOutput}`);
}

async function stopApi() {
  if (!apiProcess || apiProcess.exitCode !== null) {
    return;
  }
  apiProcess.kill();
  await Promise.race([
    new Promise((resolve) => apiProcess.once("exit", resolve)),
    delay(1_000),
  ]);
  if (apiProcess.exitCode === null) {
    apiProcess.kill("SIGKILL");
  }
}

try {
  const mockAddress = await mockLms.listen();
  assert.ok(mockAddress && typeof mockAddress !== "string");
  const mockConfig = mockLms.getConfiguration();
  const targetLinkUris = [
    mockConfig.defaultTargetLinkUri,
    `${apiBaseUrl}/standalone.html`,
  ];
  apiProcess = spawn(process.execPath, [path.join(root, "apps", "api", "dist", "main.js")], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      LTI_TOOL_BASE_URL: apiBaseUrl,
      LTI_TOOL_TARGET_LINK_URIS: JSON.stringify(targetLinkUris),
      LTI_PLATFORMS_JSON: JSON.stringify([mockConfig.registration]),
      LTI_MOCK_PLATFORM_ENABLED: "true",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  apiProcess.stdout.on("data", (chunk) => {
    apiOutput = `${apiOutput}${chunk}`.slice(-4_000);
  });
  apiProcess.stderr.on("data", (chunk) => {
    apiOutput = `${apiOutput}${chunk}`.slice(-4_000);
  });
  await waitForApi();

  let helperLogin;
  let helperLaunch;
  let helperCookie;
  let helperToken;

  await runCheck("tool and mock-platform JWKS publish RS256 public keys", async () => {
    for (const endpoint of ["/api/v1/lti/jwks", "/api/v1/lti/mock-platform/jwks"]) {
      const response = await request(`${apiBaseUrl}${endpoint}`);
      assert.equal(response.status, 200);
      const jwks = await response.json();
      assert.ok(jwks.keys.length > 0);
      assert.ok(jwks.keys.every((key) => key.alg === "RS256" && key.kty === "RSA"));
      assert.ok(jwks.keys.every((key) => !("d" in key)));
    }
  });

  await runCheck("POST login returns cookie-bound state, nonce, and auth URL", async () => {
    const login = await loginWithApiMockPlatform();
    helperLogin = login;
    helperCookie = login.cookie;
  });

  await runCheck("valid signed launch returns a verified learner", async () => {
    const result = await launchWithApiMockPlatform();
    helperLaunch = result;
    helperToken = result.signed.id_token;
    assert.equal(result.response.status, 200);
    const body = await result.response.json();
    assert.equal(body.verified, true);
    assert.equal(body.role, "Learner");
    assert.equal(body.learner.sub, "mock-learner-001");
    assert.equal(body.learner.lang, "en");
  });

  await runCheck("replaying a consumed launch is rejected bilingually", async () => {
    const response = await request(`${apiBaseUrl}/api/v1/lti/launch`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: `db_lti_state=${helperCookie}`,
      },
      body: new URLSearchParams({
        id_token: helperToken,
        state: helperLogin.state,
      }),
    });
    assertBilingualUnauthorized(response.status, await response.json());
    assert.ok(helperLaunch);
  });

  await runCheck("tampered launch signature is rejected bilingually", async () => {
    const result = await launchWithApiMockPlatform({ tampered: true });
    assertBilingualUnauthorized(result.response.status, await result.response.json());
  });

  await runCheck("AGS sync records a 1/1 FullyGraded receipt", async () => {
    const launch = await launchWithMockLms();
    assert.equal(launch.response.status, 200);
    const syncResponse = await request(`${apiBaseUrl}/api/v1/lti/ags/sync`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${launch.body.sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sessionId: "mock-course-001",
        userId: "mock-learner-001",
        scoreGiven: 1,
        scoreMaximum: 1,
        activityProgress: "Completed",
        gradingProgress: "FullyGraded",
      }),
    });
    assert.ok([200, 201].includes(syncResponse.status));
    const result = await syncResponse.json();
    assert.equal(result.grade.scoreGiven, 1);
    assert.equal(result.grade.scoreMaximum, 1);
    assert.equal(result.grade.gradingProgress, "FullyGraded");
    const gradesResponse = await request(`${apiBaseUrl}/api/v1/lti/ags/grades`, {
      headers: { authorization: `Bearer ${launch.body.sessionToken}` },
    });
    assert.equal(gradesResponse.status, 200);
    assert.equal((await gradesResponse.json()).grades.length, 1);
  });

  await runCheck("NRPS roster exposes role and progress but no support fields", async () => {
    const launch = await launchWithMockLms("teacher");
    assert.equal(launch.response.status, 200);
    const response = await request(`${apiBaseUrl}/api/v1/lti/nrps/roster`, {
      headers: { authorization: `Bearer ${launch.body.sessionToken}` },
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.ok(result.members.length > 0);
    assert.equal(result.members[0].role, "Learner");
    assert.equal(result.members[0].status, "Completed");
    assert.doesNotMatch(JSON.stringify(result), /support|accommodation|disability/i);
  });

  await runCheck("Deep Linking response is signed and contains the activity", async () => {
    const launch = await launchWithMockLms("deep-link");
    assert.equal(launch.response.status, 200);
    const response = await request(`${apiBaseUrl}/api/v1/lti/deep-link`, {
      method: "POST",
      headers: { authorization: `Bearer ${launch.body.sessionToken}` },
    });
    assert.equal(response.status, 200);
    const html = await response.text();
    const token = /name="JWT" value="([^"]+)"/.exec(html)?.[1];
    assert.ok(token);
    const parts = token.split(".");
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    const jwksResponse = await request(`${apiBaseUrl}/api/v1/lti/jwks`);
    const jwks = await jwksResponse.json();
    const jwk = jwks.keys.find((key) => key.kid === header.kid);
    assert.ok(jwk);
    const publicKey = (await import("node:crypto")).createPublicKey({
      key: jwk,
      format: "jwk",
    });
    assert.equal(
      (await import("node:crypto")).verify(
        "RSA-SHA256",
        Buffer.from(`${parts[0]}.${parts[1]}`),
        publicKey,
        Buffer.from(parts[2], "base64url"),
      ),
      true,
    );
    assert.equal(
      payload["https://purl.imsglobal.org/spec/lti/claim/message_type"],
      "LtiDeepLinkingResponse",
    );
    const returnResponse = await request(`${mockConfig.origin}/mock-lms/deep-link-return`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ JWT: token }),
    });
    assert.equal(returnResponse.status, 200);
  });

  assert.equal(checkCount, 8);
  process.stdout.write("All 8 LTI checks passed.\n");
} catch (error) {
  process.stderr.write(
    `LTI verification failed: ${error.stack || error.message}\n${apiOutput}`,
  );
  process.exitCode = 1;
} finally {
  await stopApi();
  await mockLms.close();
}
