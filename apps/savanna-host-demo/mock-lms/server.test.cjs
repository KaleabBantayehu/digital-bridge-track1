"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");
const { createMockLmsServer } = require("./server.cjs");

async function withMockLms(run) {
  const mockLms = createMockLmsServer({
    port: 0,
    host: "127.0.0.1",
    toolBaseUrl: "http://127.0.0.1:3000",
  });
  const address = await mockLms.listen();
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    await run(mockLms, origin);
  } finally {
    await mockLms.close();
  }
}

function makeAuthorizationUrl(config, overrides = {}) {
  const url = new URL(config.authorizationEndpoint);
  const params = {
    client_id: config.clientId,
    response_type: "id_token",
    response_mode: "form_post",
    prompt: "none",
    scope: "openid",
    login_hint: "mock-learner@example.test",
    redirect_uri: `${config.toolBaseUrl}/api/v1/lti/launch`,
    state: "s".repeat(43),
    nonce: "n".repeat(43),
    ...overrides,
  };
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value);
  }
  return url;
}

function readHiddenInput(html, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(
    `<input type="hidden" name="${escapedName}" value="([^"]*)">`,
  ).exec(html);
  assert.ok(match, `Expected a hidden ${name} field in the Mock LMS form`);
  return match[1];
}

function verifyMockToken(token, jwk) {
  const parts = token.split(".");
  assert.equal(parts.length, 3);
  const publicKey = crypto.createPublicKey({ key: jwk, format: "jwk" });
  const verified = crypto.verify(
    "RSA-SHA256",
    Buffer.from(`${parts[0]}.${parts[1]}`),
    publicKey,
    Buffer.from(parts[2], "base64url"),
  );
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  return { verified, payload };
}

test("Mock LMS publishes only its public signing key", async () => {
  await withMockLms(async (mockLms, origin) => {
    const response = await fetch(`${origin}/mock-lms/jwks`);
    assert.equal(response.status, 200);
    const jwks = await response.json();
    assert.deepEqual(Object.keys(jwks), ["keys"]);
    assert.equal(jwks.keys.length, 1);
    assert.equal(jwks.keys[0].alg, "RS256");
    assert.equal(jwks.keys[0].use, "sig");
    assert.equal(jwks.keys[0].key_ops[0], "verify");
    for (const privateField of ["d", "dp", "dq", "p", "q", "qi", "oth"]) {
      assert.equal(privateField in jwks.keys[0], false);
    }

    const configResponse = await fetch(`${origin}/mock-lms/config`);
    const config = await configResponse.json();
    assert.equal(config.issuer, `${origin}/mock-lms/issuer`);
    assert.equal(config.registration.jwksUrl, `${origin}/mock-lms/jwks`);
    assert.deepEqual(mockLms.getPublicJwks(), jwks);
  });
});

test("Mock LMS signs claims accepted by the real LTI launch route", async () => {
  await withMockLms(async (_mockLms, origin) => {
    const config = await (await fetch(`${origin}/mock-lms/config`)).json();
    const jwks = await (await fetch(`${origin}/mock-lms/jwks`)).json();
    const response = await fetch(makeAuthorizationUrl(config));
    assert.equal(response.status, 200);

    const html = await response.text();
    assert.match(html, /Continue to Digital Bridge/);
    assert.match(html, /requestSubmit/);
    const action = /<form id="launch" action="([^"]+)" method="post">/.exec(html);
    assert.ok(action);
    assert.equal(action[1], `${config.toolBaseUrl}/api/v1/lti/launch`);

    const token = readHiddenInput(html, "id_token");
    assert.equal(readHiddenInput(html, "state"), "s".repeat(43));
    const { verified, payload } = verifyMockToken(token, jwks.keys[0]);
    assert.equal(verified, true);
    assert.equal(payload.iss, config.issuer);
    assert.equal(payload.aud, config.clientId);
    assert.equal(payload.nonce, "n".repeat(43));
    assert.equal(payload["https://purl.imsglobal.org/spec/lti/claim/version"], "1.3.0");
    assert.equal(
      payload["https://purl.imsglobal.org/spec/lti/claim/deployment_id"],
      config.deploymentId,
    );
    assert.equal(payload["https://purl.imsglobal.org/spec/lti/claim/context"].id, "mock-course-001");
  });
});

test("Mock LMS can create a tampered-signature test and blocks redirect overrides", async () => {
  await withMockLms(async (_mockLms, origin) => {
    const config = await (await fetch(`${origin}/mock-lms/config`)).json();
    const jwks = await (await fetch(`${origin}/mock-lms/jwks`)).json();
    const tamperedUrl = makeAuthorizationUrl(config, {
      lti_message_hint: "mock-tamper-signature",
    });
    const tamperedHtml = await (await fetch(tamperedUrl)).text();
    const tamperedToken = readHiddenInput(tamperedHtml, "id_token");
    assert.equal(verifyMockToken(tamperedToken, jwks.keys[0]).verified, false);

    const openRedirectUrl = makeAuthorizationUrl(config, {
      redirect_uri: "https://attacker.example/collect",
    });
    const rejected = await fetch(openRedirectUrl);
    assert.equal(rejected.status, 400);
    assert.doesNotMatch(await rejected.text(), /id_token/);
  });
});

test("Mock LMS binds only to loopback addresses", () => {
  assert.throws(
    () => createMockLmsServer({ host: "0.0.0.0", port: 4001 }),
    /loopback address/,
  );
});
