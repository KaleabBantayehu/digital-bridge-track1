"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const LTI_CLAIMS = {
  messageType: "https://purl.imsglobal.org/spec/lti/claim/message_type",
  version: "https://purl.imsglobal.org/spec/lti/claim/version",
  deploymentId: "https://purl.imsglobal.org/spec/lti/claim/deployment_id",
  roles: "https://purl.imsglobal.org/spec/lti/claim/roles",
  context: "https://purl.imsglobal.org/spec/lti/claim/context",
  resourceLink: "https://purl.imsglobal.org/spec/lti/claim/resource_link",
};

const STATIC_ROOT = path.resolve(__dirname, "..");
const INDEX_PATH = path.join(__dirname, "index.html");
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function isLoopbackHost(hostname) {
  const normalized = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
  return LOOPBACK_HOSTS.has(normalized);
}

function parseLoopbackOrigin(value, name) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid local HTTP URL.`);
  }
  if (
    url.protocol !== "http:" ||
    !isLoopbackHost(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${name} must be an HTTP origin on localhost or a loopback address.`);
  }
  return url.origin;
}

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signJwt(payload, privateKey, keyId) {
  const header = encodeJson({ alg: "RS256", typ: "JWT", kid: keyId });
  const encodedPayload = encodeJson(payload);
  const signingInput = `${header}.${encodedPayload}`;
  const signature = crypto
    .sign("RSA-SHA256", Buffer.from(signingInput), privateKey)
    .toString("base64url");
  return `${signingInput}.${signature}`;
}

function tamperSignature(token) {
  const parts = token.split(".");
  const signature = Buffer.from(parts[2], "base64url");
  signature[0] ^= 1;
  parts[2] = signature.toString("base64url");
  return parts.join(".");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(message);
}

function sendHtml(response, statusCode, html) {
  response.writeHead(statusCode, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "content-security-policy": "default-src 'none'; connect-src 'self'; form-action http: https:; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  });
  response.end(html);
}

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(value));
}

function createMockLmsServer(options = {}) {
  const host = options.host || "127.0.0.1";
  if (!isLoopbackHost(host)) {
    throw new Error("The Mock LMS must bind to localhost or a loopback address.");
  }
  const port = options.port ?? 4001;
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("The Mock LMS port must be a valid TCP port.");
  }
  const configuredOrigin = options.origin
    ? parseLoopbackOrigin(options.origin, "Mock LMS origin")
    : undefined;
  const toolBaseUrl = parseLoopbackOrigin(
    options.toolBaseUrl || process.env.MOCK_LMS_TOOL_BASE_URL || "http://127.0.0.1:3000",
    "Tool base URL",
  );
  const clientId = options.clientId || "digital-bridge-demo";
  const deploymentId = options.deploymentId || "mock-deployment";
  const keyPair = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const publicKey = crypto.createPublicKey(keyPair.privateKey);
  const publicKeyDer = publicKey.export({ format: "der", type: "spki" });
  const keyId = crypto
    .createHash("sha256")
    .update(publicKeyDer)
    .digest("base64url")
    .slice(0, 22);
  const exportedPublicJwk = publicKey.export({ format: "jwk" });
  const publicJwk = {
    ...exportedPublicJwk,
    alg: "RS256",
    use: "sig",
    key_ops: ["verify"],
    kid: keyId,
  };

  function getOrigin() {
    if (configuredOrigin) {
      return configuredOrigin;
    }
    const address = server.address();
    const actualPort =
      address && typeof address !== "string" ? address.port : port;
    const formattedHost = host.includes(":") ? `[${host}]` : host;
    return `http://${formattedHost}:${actualPort}`;
  }

  function getConfiguration() {
    const origin = getOrigin();
    return {
      origin,
      issuer: `${origin}/mock-lms/issuer`,
      clientId,
      authorizationEndpoint: `${origin}/mock-lms/authorize`,
      jwksUrl: `${origin}/mock-lms/jwks`,
      deploymentId,
      toolBaseUrl,
      defaultTargetLinkUri: `${origin}/standalone.html`,
      registration: {
        issuer: `${origin}/mock-lms/issuer`,
        clientId,
        authorizationEndpoint: `${origin}/mock-lms/authorize`,
        jwksUrl: `${origin}/mock-lms/jwks`,
        deploymentIds: [deploymentId],
      },
    };
  }

  function renderAuthorizationResponse(requestUrl) {
    const config = getConfiguration();
    const params = requestUrl.searchParams;
    const state = params.get("state");
    const nonce = params.get("nonce");
    const loginHint = params.get("login_hint");
    const redirectUri = params.get("redirect_uri");
    const expectedRedirectUri = `${config.toolBaseUrl}/api/v1/lti/launch`;
    const scope = (params.get("scope") || "").split(/\s+/);

    if (
      params.get("client_id") !== clientId ||
      params.get("response_type") !== "id_token" ||
      params.get("response_mode") !== "form_post" ||
      params.get("prompt") !== "none" ||
      !scope.includes("openid") ||
      !loginHint ||
      !/^[A-Za-z0-9_-]{43}$/.test(state || "") ||
      !/^[A-Za-z0-9_-]{43}$/.test(nonce || "") ||
      redirectUri !== expectedRedirectUri
    ) {
      return {
        statusCode: 400,
        html: "<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><title>Mock LMS request rejected</title><p>The login request is incomplete or does not match the local Mock LMS configuration.</p></html>",
      };
    }

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: config.issuer,
      sub: "mock-learner-001",
      aud: clientId,
      iat: now,
      exp: now + 300,
      nonce,
      name: "Mock Learner",
      [LTI_CLAIMS.messageType]: "LtiResourceLinkRequest",
      [LTI_CLAIMS.version]: "1.3.0",
      [LTI_CLAIMS.deploymentId]: deploymentId,
      [LTI_CLAIMS.roles]: [
        "http://purl.imsglobal.org/vocab/lis/v2/membership#Learner",
      ],
      [LTI_CLAIMS.context]: { id: "mock-course-001", label: "Demo course" },
      [LTI_CLAIMS.resourceLink]: { id: "mock-resource-001", title: "Onboarding" },
    };
    let token = signJwt(payload, keyPair.privateKey, keyId);
    const tokenTampered =
      params.get("lti_message_hint") === "mock-tamper-signature";
    if (tokenTampered) {
      token = tamperSignature(token);
    }

    return {
      statusCode: 200,
      html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Continue to Digital Bridge</title>
    <style>
      body { font: 1rem/1.5 system-ui, sans-serif; margin: 2rem auto; max-width: 40rem; padding: 1rem; }
      button { min-height: 44px; padding: .6rem 1rem; }
    </style>
  </head>
  <body>
    <main>
      <h1>${tokenTampered ? "Tampered-token test" : "Mock LMS sign-in"}</h1>
      <p>${tokenTampered ? "This test token has a changed signature. The API should reject it." : "The Mock LMS signed a launch request. Continue to the Digital Bridge API."}</p>
      <form id="launch" action="${escapeHtml(redirectUri)}" method="post">
        <input type="hidden" name="id_token" value="${escapeHtml(token)}">
        <input type="hidden" name="state" value="${escapeHtml(state)}">
        <button type="submit">Continue to Digital Bridge</button>
      </form>
    </main>
    <script>document.getElementById("launch").requestSubmit();</script>
  </body>
</html>`,
    };
  }

  function serveStaticFile(response, requestPath) {
    let relativePath;
    if (requestPath === "/standalone.html") {
      relativePath = "standalone.html";
    } else if (requestPath.startsWith("/assets/")) {
      relativePath = requestPath.slice(1);
    } else {
      sendText(response, 404, "Not found");
      return;
    }

    const filePath = path.resolve(STATIC_ROOT, relativePath);
    if (!filePath.startsWith(`${STATIC_ROOT}${path.sep}`)) {
      sendText(response, 403, "Forbidden");
      return;
    }
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      sendText(response, 404, "The requested demo file is not available.");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentTypes = {
      ".css": "text/css; charset=utf-8",
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".woff2": "font/woff2",
    };
    response.writeHead(200, {
      "content-type": contentTypes[extension] || "application/octet-stream",
      "x-content-type-options": "nosniff",
    });
    response.end(fs.readFileSync(filePath));
  }

  const server = http.createServer((request, response) => {
    let requestUrl;
    try {
      requestUrl = new URL(request.url || "/", getOrigin());
    } catch {
      sendText(response, 400, "Invalid request URL");
      return;
    }

    if (request.method !== "GET") {
      response.setHeader("allow", "GET");
      sendText(response, 405, "Method not allowed");
      return;
    }
    if (requestUrl.pathname === "/" || requestUrl.pathname === "/mock-lms") {
      sendHtml(response, 200, fs.readFileSync(INDEX_PATH, "utf8"));
      return;
    }
    if (requestUrl.pathname === "/mock-lms/config") {
      sendJson(response, 200, getConfiguration());
      return;
    }
    if (requestUrl.pathname === "/mock-lms/jwks") {
      sendJson(response, 200, { keys: [publicJwk] });
      return;
    }
    if (requestUrl.pathname === "/mock-lms/authorize") {
      const result = renderAuthorizationResponse(requestUrl);
      sendHtml(response, result.statusCode, result.html);
      return;
    }

    serveStaticFile(response, requestUrl.pathname);
  });

  return {
    server,
    getConfiguration,
    getPublicJwks: () => ({ keys: [{ ...publicJwk }] }),
    listen: () =>
      new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => resolve(server.address()));
      }),
    close: () =>
      new Promise((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

if (require.main === module) {
  const requestedPort = Number(process.env.MOCK_LMS_PORT || 4001);
  if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) {
    throw new Error("MOCK_LMS_PORT must be a valid TCP port.");
  }
  const mockLms = createMockLmsServer({
    port: requestedPort,
    host: process.env.MOCK_LMS_HOST || "127.0.0.1",
    origin: process.env.MOCK_LMS_ORIGIN,
  });
  mockLms.listen().then(() => {
    const config = mockLms.getConfiguration();
    process.stdout.write(`Mock LMS ready: ${config.origin}/mock-lms\n`);
    process.stdout.write(
      `Register this JSON in LTI_PLATFORMS_JSON:\n${JSON.stringify([config.registration], null, 2)}\n`,
    );
  }).catch((error) => {
    process.stderr.write(`Mock LMS could not start: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { createMockLmsServer, signJwt, tamperSignature };
