# Local Mock LMS

This small local server acts like a learning platform for testing LTI 1.3. It creates a temporary
RSA key when it starts, publishes only the public key at `/mock-lms/jwks`, and signs a real LTI
launch token on the server. The token is sent to the API's normal `/api/v1/lti/launch` route.

The private key exists only in this local process. It is not written to disk and this simulator is
not intended for production.

## Run it

From the repository root, start the simulator:

```powershell
node apps/savanna-host-demo/mock-lms/server.cjs
```

The command starts a local website on port `4001` and prints the platform registration details.
Open `http://127.0.0.1:4001/mock-lms` in a browser. The page has a valid-launch button and a
tampered-signature button; the second button should end at a bilingual `401` response from the API.

In another PowerShell terminal, configure and start the API:

```powershell
$env:LTI_PLATFORMS_JSON = '[{"issuer":"http://127.0.0.1:4001/mock-lms/issuer","clientId":"digital-bridge-demo","authorizationEndpoint":"http://127.0.0.1:4001/mock-lms/authorize","jwksUrl":"http://127.0.0.1:4001/mock-lms/jwks","deploymentIds":["mock-deployment"]}]'
$env:LTI_TOOL_BASE_URL = 'http://127.0.0.1:3000'
$env:LTI_TOOL_TARGET_LINK_URIS = '["http://127.0.0.1:4001/standalone.html"]'
pnpm --filter @db/api dev
```

The tool page address in the Mock LMS form must exactly match an address in
`LTI_TOOL_TARGET_LINK_URIS`. The API uses the platform registration to know which issuer and public
key it trusts.

## Automated checks

From the repository root, run:

```powershell
node --test apps/savanna-host-demo/mock-lms/server.test.cjs
```

These tests verify the public JWKS contains no private key fields, check a signed token's real
RS256 signature and LTI claims, confirm the tampered-token path produces a bad signature, and
reject an untrusted redirect address.

## Local configuration

`MOCK_LMS_PORT` changes the listener port (default `4001`), and `MOCK_LMS_HOST` may be set to
`127.0.0.1`, `localhost`, or `::1`. The server refuses to listen on a public network address.
`MOCK_LMS_TOOL_BASE_URL` changes the API origin the simulator will accept for the launch callback.
These settings are for local testing only.
