import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("Mock LMS and standalone demo have no serious or critical axe violations", async ({
  page,
}) => {
  for (const path of ["/mock-lms", "/standalone.html"]) {
    await page.goto(`http://127.0.0.1:4001${path}`);
    const results = await new AxeBuilder({ page }).analyze();
    const seriousOrCritical = results.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    );
    expect(
      seriousOrCritical,
      `${path} has serious or critical accessibility violations`,
    ).toEqual([]);
  }
});
