import { expect, request, test } from "@playwright/test";

const apiBaseUrl = "http://127.0.0.1:3099";

async function prepareLaunch(mode: "student" | "tampered") {
  const platformResponse = await request.newContext();
  const configResponse = await platformResponse.get(
    "http://127.0.0.1:4001/mock-lms/config",
  );
  const config = await configResponse.json();
  const loginUrl = new URL("/api/v1/lti/login", apiBaseUrl);
  for (const [key, value] of Object.entries({
    iss: config.issuer,
    client_id: config.clientId,
    login_hint: "mock-learner@example.test",
    target_link_uri: config.defaultTargetLinkUri,
    ...(mode === "tampered"
      ? { lti_message_hint: "mock-tamper-signature" }
      : {}),
  })) {
    loginUrl.searchParams.set(key, value);
  }
  const login = await platformResponse.get(loginUrl.toString(), {
    maxRedirects: 0,
  });
  const location = login.headers().location;
  const cookie = (await login.headersArray()).find(
    (header) => header.name.toLowerCase() === "set-cookie",
  )?.value;
  expect(login.status()).toBe(302);
  expect(location).toBeTruthy();
  const cookieValue = /(?:^|;\s*)db_lti_state=([^;]+)/.exec(cookie || "")?.[1];
  expect(cookieValue).toBeTruthy();

  const authorization = await platformResponse.get(location);
  const html = await authorization.text();
  const idToken = /name="id_token" value="([^"]+)"/.exec(html)?.[1];
  const state = /name="state" value="([^"]+)"/.exec(html)?.[1];
  expect(idToken).toBeTruthy();
  expect(state).toBeTruthy();
  return { platformResponse, idToken: idToken!, state: state!, cookieValue: cookieValue! };
}

test("real Mock LMS launch verifies while a tampered JWT is refused with bilingual 401", async () => {
  const valid = await prepareLaunch("student");
  try {
    const accepted = await valid.platformResponse.post(
      `${apiBaseUrl}/api/v1/lti/launch`,
      {
        headers: { cookie: `db_lti_state=${valid.cookieValue}` },
        form: { id_token: valid.idToken, state: valid.state },
      },
    );
    expect(accepted.status()).toBe(200);
    const acceptedBody = await accepted.json();
    expect(acceptedBody.verified).toBe(true);
    expect(acceptedBody.role).toBe("Learner");

    const tampered = await prepareLaunch("tampered");
    try {
      const refused = await tampered.platformResponse.post(
        `${apiBaseUrl}/api/v1/lti/launch`,
        {
          headers: { cookie: `db_lti_state=${tampered.cookieValue}` },
          form: { id_token: tampered.idToken, state: tampered.state },
        },
      );
      expect(refused.status()).toBe(401);
      const error = await refused.json();
      expect(error.error).toBe("LtiLaunchRejected");
      expect(error.summary.en).toBeTruthy();
      expect(error.summary.am).toBeTruthy();
    } finally {
      await tampered.platformResponse.dispose();
    }
  } finally {
    await valid.platformResponse.dispose();
  }
});
