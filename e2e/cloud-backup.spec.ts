import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const author = "10000000-0000-4000-8000-000000000001";
const revision = "20000000-0000-4000-8000-000000000001";
const original = {
  version: 1,
  inventory: [
    {
      id: "local-paper",
      materialId: "unknown",
      label: "Local paper",
      quantity: 2,
      unit: "แผ่น",
      condition: "unknown",
      verified: false,
      specs: {},
      notes: "private note",
    },
  ],
  builds: [],
};
const metadata = { revision, updated_at: "2026-10-21T08:00:00+00:00" };
async function fixture(page: Page) {
  let cloud: Record<string, unknown> | null = null;
  let fail: "" | "conflict" | "setup" = "";
  const calls: { path: string; method: string; body: unknown }[] = [];
  await page.addInitScript(
    ({ author, original }) => {
      localStorage.setItem("rebuild.language", "en");
      if (!localStorage.getItem("rebuild.guest.v1"))
        localStorage.setItem("rebuild.guest.v1", JSON.stringify(original));
      const now = Math.floor(Date.now() / 1000);
      const encode = (value: unknown) =>
        btoa(JSON.stringify(value))
          .replaceAll("=", "")
          .replaceAll("+", "-")
          .replaceAll("/", "_");
      localStorage.setItem(
        "sb-localhost-auth-token",
        JSON.stringify({
          access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: author, exp: now + 3600, aud: "authenticated" })}.fixture`,
          refresh_token: "fixture-refresh",
          expires_in: 3600,
          expires_at: now + 3600,
          token_type: "bearer",
          user: {
            id: author,
            aud: "authenticated",
            role: "authenticated",
            email: "fixture@example.test",
            email_confirmed_at: new Date().toISOString(),
            app_metadata: {},
            user_metadata: {},
            created_at: new Date().toISOString(),
          },
        }),
      );
    },
    { author, original },
  );
  await page.route("**/api/community/**", async (route) => {
    const url = new URL(route.request().url());
    const body = url.pathname.endsWith("/config")
      ? { enabled: true, url: url.origin, publishableKey: "fixture-public" }
      : url.pathname.endsWith("/me")
        ? { moderator: false }
        : { entries: [], hasMore: false };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const body = request.postData() ? request.postDataJSON() : null;
    calls.push({ path, method: request.method(), body });
    if (fail === "setup") {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ code: "PGRST205", message: "Missing table" }),
      });
      return;
    }
    if (fail === "conflict" && request.method() === "POST") {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ code: "40001", message: "Backup changed" }),
      });
      return;
    }
    let response: unknown = cloud;
    if (path.endsWith("save_rebuild_backup")) {
      cloud = { ...metadata, payload: body.new_payload };
      response = [metadata];
    } else if (path.endsWith("delete_rebuild_backup")) {
      cloud = null;
      response = true;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });
  return {
    calls,
    setFailure(value: typeof fail) {
      fail = value;
    },
    setCloud(payload: unknown) {
      cloud = { ...metadata, payload };
    },
  };
}

test("account backups wait for explicit actions, upload confirmed data and restore only after preview", async ({
  page,
}) => {
  const f = await fixture(page);
  await page.goto("/#/account");
  const panel = page.getByRole("region", {
    name: "Account backup",
    exact: true,
  });
  await expect(
    panel.getByRole("button", { name: "Check account backup" }),
  ).toBeVisible();
  expect(f.calls).toEqual([]);
  await panel.getByRole("button", { name: "Check account backup" }).click();
  await expect(
    panel.getByText("This account has no backup yet."),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.dismiss());
  await panel.getByRole("button", { name: "Upload local backup" }).click();
  expect(f.calls.filter((c) => c.method === "POST")).toHaveLength(0);
  page.once("dialog", (dialog) => dialog.accept());
  await panel.getByRole("button", { name: "Upload local backup" }).click();
  await expect(
    panel.getByText("Account backup saved. Automatic syncing is off."),
  ).toBeVisible();
  expect(f.calls.at(-1)?.body).toMatchObject({
    expected_user_id: author,
    expected_revision: null,
    new_payload: original,
  });
  f.setCloud({ version: 1, inventory: [], builds: [] });
  await panel.getByRole("button", { name: "Check account backup" }).click();
  await expect(panel.getByText(/Account backup: 0 items/)).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await panel
    .getByRole("button", { name: "Restore account backup", exact: true })
    .click();
  await expect(
    panel.getByText("Account backup restored to this browser."),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("rebuild.guest.v1")!).inventory,
    ),
  ).toEqual([]);
  page.once("dialog", (dialog) => dialog.accept());
  await panel
    .getByRole("button", { name: "Delete account backup", exact: true })
    .click();
  await expect(panel.getByText("Account backup deleted.")).toBeVisible();
  expect(f.calls.at(-1)?.body).toEqual({
    expected_user_id: author,
    expected_revision: revision,
  });
});

test("cloud conflicts require refresh and missing owner setup preserves local data", async ({
  page,
}) => {
  const f = await fixture(page);
  f.setCloud(original);
  await page.goto("/#/account");
  const panel = page.getByRole("region", {
    name: "Account backup",
    exact: true,
  });
  await panel.getByRole("button", { name: "Check account backup" }).click();
  await expect(panel.getByText(/Account backup: 1 items/)).toBeVisible();
  f.setFailure("conflict");
  page.once("dialog", (dialog) => dialog.accept());
  await panel.getByRole("button", { name: "Upload local backup" }).click();
  await expect(panel.getByRole("alert")).toContainText(
    "changed on another device",
  );
  await expect(
    panel.getByRole("button", { name: "Upload local backup" }),
  ).toHaveCount(0);
  f.setFailure("setup");
  await panel.getByRole("button", { name: "Check account backup" }).click();
  await expect(panel.getByRole("alert")).toContainText("not enabled yet");
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("rebuild.guest.v1")!).inventory[0]
          .notes,
    ),
  ).toBe("private note");
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
});

test("an incompatible account snapshot can be downloaded or deleted without restoring it", async ({
  page,
}) => {
  const f = await fixture(page);
  f.setCloud({ version: 1, inventory: [{ invalid: true }], builds: [] });
  await page.goto("/#/account");
  const panel = page.getByRole("region", {
    name: "Account backup",
    exact: true,
  });
  await panel.getByRole("button", { name: "Check account backup" }).click();
  await expect(panel.getByRole("alert")).toContainText(
    "incompatible with this version",
  );
  await expect(
    panel.getByRole("button", { name: "Restore account backup", exact: true }),
  ).toHaveCount(0);
  const download = page.waitForEvent("download");
  await panel.getByRole("button", { name: "Download recovery file" }).click();
  expect((await download).suggestedFilename()).toBe(
    "rebuild-account-backup-recovery.json",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("rebuild.guest.v1")!).inventory[0]
          .label,
    ),
  ).toBe("Local paper");
  page.once("dialog", (dialog) => dialog.accept());
  await panel
    .getByRole("button", { name: "Delete account backup", exact: true })
    .click();
  await expect(panel.getByText("Account backup deleted.")).toBeVisible();
  expect(f.calls.at(-1)?.body).toEqual({
    expected_user_id: author,
    expected_revision: revision,
  });
});
