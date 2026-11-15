import { defineConfig } from "@playwright/test";

const apiBaseUrl = "http://127.0.0.1:3099";
const mockLmsOrigin = "http://127.0.0.1:4001";
const platform = {
  issuer: `${mockLmsOrigin}/mock-lms/issuer`,
  clientId: "digital-bridge-demo",
  authorizationEndpoint: `${mockLmsOrigin}/mock-lms/authorize`,
  jwksUrl: `${mockLmsOrigin}/mock-lms/jwks`,
  deploymentIds: ["mock-deployment"],
  tokenEndpoint: `${mockLmsOrigin}/mock-lms/token`,
};

export default defineConfig({
  testDir: "./e2e",
  timeout: 10_000,
  globalTimeout: 45_000,
  expect: { timeout: 3_000 },
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: apiBaseUrl,
    trace: "off",
  },
  webServer: [
    {
      command: "node apps/savanna-host-demo/mock-lms/server.cjs",
      url: `${mockLmsOrigin}/mock-lms/config`,
      timeout: 10_000,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
      env: { MOCK_LMS_TOOL_BASE_URL: apiBaseUrl },
    },
    {
      command: "node apps/api/dist/main.js",
      url: `${apiBaseUrl}/api/v1/health`,
      timeout: 15_000,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        NODE_ENV: "test",
        PORT: "3099",
        LTI_TOOL_BASE_URL: apiBaseUrl,
        LTI_TOOL_TARGET_LINK_URIS: JSON.stringify([
          `${mockLmsOrigin}/standalone.html`,
          `${apiBaseUrl}/standalone.html`,
        ]),
        LTI_PLATFORMS_JSON: JSON.stringify([platform]),
        LTI_MOCK_PLATFORM_ENABLED: "true",
      },
    },
  ],
});
