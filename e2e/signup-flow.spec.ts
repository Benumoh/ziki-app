import { test, expect, expectNoHorizontalScroll } from "./fixtures";

test.use({ as: null });

/**
 * #onboarding / #getting-started: a brand-new person, end to end. Sign up, the welcome checklist, an organisation
 * (which comes with its Web project), Get started on the Ideas page, and a first idea. Posting it answers at once:
 * the idea page says what happens next, and the first-experience question appears. Runs at both widths, so the
 * phone layout of each page is checked too.
 */
test("a new account gets from sign-up to a first idea, with feedback at the end", async ({ page, uniq }) => {
  // The whole first journey in one test, several pages and server actions long.
  test.setTimeout(60_000);
  const label = uniq("Newcomer");
  const email = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@test.local`;
  const password = "e2e-newcomer-123";

  // Sign up.
  await page.goto("/signup");
  await page.getByLabel("Name").fill(label);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("textbox", { name: "Confirm password" }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  // The welcome checklist: account done, then a goal. Signing up hashes the password and goes /home → /welcome,
  // so this step gets longer than the default wait.
  await expect(page).toHaveURL(/\/welcome/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 1, name: /Welcome to Ziki/ })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.getByText("Explore projects", { exact: true }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("progressbar", { name: "Checklist progress" })).toHaveAttribute("aria-valuenow", "2");

  // An organisation, which comes with its Web project and opens it.
  await page.getByRole("button", { name: /Join or create an organisation/ }).click();
  await page.getByRole("button", { name: "Create organisation" }).click();
  await expect(page).toHaveURL(/\/organisations/);
  await page.getByLabel("Organisation name").fill(uniq("Newcomer Co"));
  await page.getByLabel("Organisation name").press("Enter");

  // Get started on the Ideas page carries on from there (by way of /home). No feedback question yet: nothing to rate.
  await expect(page).toHaveURL(/\/web\/ideas/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Get started" })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Setup progress" })).toHaveAttribute("aria-valuenow", "1");
  await expect(page.getByRole("heading", { name: "How was your first experience with Ziki?" })).toHaveCount(0);
  await expectNoHorizontalScroll(page);

  // A first idea from one of the starters.
  await page.getByRole("button", { name: "Report a bug" }).click();
  await page.getByRole("button", { name: "Send idea" }).click();

  // An answer straight away: what happens next, and the first-experience question. (Claude may write the idea up
  // before it is saved, so this step gets longer too.)
  await expect(page).toHaveURL(/\/web\/ideas\/\d+/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Your first idea is in" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "How was your first experience with Ziki?" })).toBeVisible();
  await expectNoHorizontalScroll(page);
});
