import { expect, test } from "@playwright/test";

test("Mock LMS launch controls can be reached and activated by keyboard", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:4001/mock-lms");
  const apiUrl = page.getByLabel("Digital Bridge API base URL");
  const targetUri = page.getByLabel("Tool page to open");
  const studentLaunch = page.getByRole("button", {
    name: /Launch as Student/,
  });
  const instructorLaunch = page.getByRole("button", {
    name: /Launch as Instructor|Launch as Teacher/,
  });

  await apiUrl.focus();
  await page.keyboard.press("Tab");
  await expect(targetUri).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(studentLaunch).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(instructorLaunch).toBeFocused();
  await expect(instructorLaunch).toBeEnabled();
});
