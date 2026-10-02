import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const author = "10000000-0000-4000-8000-000000000001";
const entryId = "20000000-0000-4000-8000-000000000001";
async function communityFixture(page: Page, moderator = false) {
  // Browser fixtures exercise UI states; API identity boundaries are tested separately.
  const submissions: Record<string, unknown>[] = [];
  const entry = {
    id: entryId,
    target: "drawer-dividers",
    kind: "comment",
    name: "Test maker",
    body: "A fixture submission awaiting review.",
    rating: null,
    difficulty: null,
    outcome: null,
    hasPhoto: false,
    status: "pending",
    moderation_note: "",
    created_at: "2026-10-02T12:00:00Z",
  };
  await page.addInitScript(
    ({ author }) => {
      localStorage.setItem("rebuild.language", "en");
      const now = Math.floor(Date.now() / 1000);
      const encode = (data: unknown) =>
        btoa(JSON.stringify(data))
          .replaceAll("=", "")
          .replaceAll("+", "-")
          .replaceAll("/", "_");
      const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: author, exp: now + 3600, aud: "authenticated" })}.fixture`;
      localStorage.setItem(
        "sb-fixture-auth-token",
        JSON.stringify({
          access_token: token,
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
    { author },
  );
  await page.route("**/api/community/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    let body: unknown = {};
    let status = 200;
    if (path.endsWith("/config"))
      body = {
        enabled: true,
        url: "https://fixture.supabase.co",
        publishableKey: "fixture-public-key",
      };
    else if (path.endsWith("/me")) body = { moderator };
    else if (path.endsWith("/entries") && method === "POST") {
      const posted = route.request().postDataJSON();
      submissions.push(posted);
      Object.assign(entry, posted, { status: "pending" });
      body = { id: entry.id, status: "pending" };
      status = 201;
    } else if (path.endsWith("/mine"))
      body = { entries: [entry], hasMore: false };
    else if (path.endsWith("/queue"))
      body = {
        entries: entry.status === url.searchParams.get("status") ? [entry] : [],
        hasMore: false,
      };
    else if (path.endsWith(entryId) && method === "PATCH") {
      const decision = route.request().postDataJSON();
      entry.status = decision.status;
      entry.moderation_note = decision.note;
      body = { status: entry.status };
    } else if (path.endsWith("/entries"))
      body = {
        entries: entry.status === "approved" ? [entry] : [],
        hasMore: false,
      };
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  return { submissions, entry };
}
async function accessibility(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
}
test("unconnected accounts are honest and do not block illustrated guides or website reviews", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Switch to English" }).click();
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Accounts are not connected yet" }),
  ).toBeVisible();
  await page.goto("/#/project/drawer-dividers");
  await expect(
    page.getByRole("heading", { name: "What you’ll make and how it works" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Step 1 diagram: Measure the drawer" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next step", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Step 2 diagram: Cut two dividers" }),
  ).toBeVisible();
  await page.goto("/#/reviews");
  await expect(
    page.getByRole("heading", { name: "Website reviews", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Posting and reviews are not open yet. Accounts are not connected.",
    ),
  ).toBeVisible();
  await accessibility(page);
});
test("a member submits a comment for approval and sees its private status without HTML execution", async ({
  page,
}) => {
  const { submissions } = await communityFixture(page);
  await page.goto("/#/project/drawer-dividers");
  await page.getByRole("button", { name: "Share or ask a question" }).click();
  await page
    .getByRole("textbox", { name: "Public display name" })
    .fill("New maker");
  await page
    .getByRole("textbox", { name: "Message or question" })
    .fill("My cardboard worked well. <img src=x onerror=alert(1)>");
  await page
    .getByRole("checkbox", { name: "I have read the community guidelines" })
    .check();
  await accessibility(page);
  await page.getByRole("button", { name: "Submit for approval" }).click();
  await expect(
    page.getByText("Submitted. Waiting for approval.", { exact: false }),
  ).toBeVisible();
  expect(submissions[0]).toMatchObject({
    kind: "comment",
    target: "drawer-dividers",
    guidelines: true,
  });
  await page.goto("/#/account");
  await expect(
    page.getByRole("heading", { name: "My submissions" }),
  ).toBeVisible();
  await expect(
    page.getByText("Waiting for approval", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".entry-body")).toContainText(
    "<img src=x onerror=alert(1)>",
  );
  expect(await page.locator(".entry-body img").count()).toBe(0);
  await expect(
    page.getByRole("link", { name: "Open moderation queue" }),
  ).toHaveCount(0);
});
test("project reviews include build feedback and website reviews use their separate scope", async ({
  page,
}) => {
  const { submissions } = await communityFixture(page);
  await page.goto("/#/project/drawer-dividers");
  await page.getByRole("button", { name: "Write a review" }).click();
  await page
    .getByRole("textbox", { name: "Public display name" })
    .fill("Test maker");
  await page
    .getByRole("combobox", { name: "Rating", exact: true })
    .selectOption("2");
  await page
    .getByRole("combobox", { name: "Difficulty (optional)" })
    .selectOption("moderate");
  await page
    .getByRole("combobox", { name: "Result (optional)" })
    .selectOption("partly");
  await page
    .getByRole("textbox", { name: "Your experience" })
    .fill("The centre joint needs a more careful fit.");
  await page
    .getByRole("checkbox", { name: "I have read the community guidelines" })
    .check();
  await page.getByRole("button", { name: "Submit for approval" }).click();
  await expect(
    page.getByText("Submitted. Waiting for approval.", { exact: false }),
  ).toBeVisible();
  await page.goto("/#/reviews");
  await page.getByRole("button", { name: "Write a review" }).click();
  await expect(
    page.getByRole("combobox", { name: "Difficulty (optional)" }),
  ).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Public display name" })
    .fill("Test maker");
  await page
    .getByRole("combobox", { name: "Rating", exact: true })
    .selectOption("4");
  await page
    .getByRole("textbox", { name: "Your experience" })
    .fill("The household categories are easy to browse.");
  await page
    .getByRole("checkbox", { name: "I have read the community guidelines" })
    .check();
  await page.getByRole("button", { name: "Submit for approval" }).click();
  await expect(
    page.getByText("Submitted. Waiting for approval.", { exact: false }),
  ).toBeVisible();
  expect(
    submissions.map((s) => ({ target: s.target, rating: s.rating })),
  ).toEqual([
    { target: "drawer-dividers", rating: 2 },
    { target: "website", rating: 4 },
  ]);
});
test("a moderator approves, then unpublishes a submission with an author-facing reason", async ({
  page,
}) => {
  const { entry } = await communityFixture(page, true);
  await page.goto("/#/account");
  await page.getByRole("link", { name: "Open moderation queue" }).click();
  await expect(
    page.getByText("A fixture submission awaiting review."),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Note for the author" })
    .fill("Useful, respectful advice.");
  await accessibility(page);
  await page.getByRole("button", { name: "Approve & publish" }).click();
  await expect(page.getByText("No submissions on this page.")).toBeVisible();
  expect(entry.status).toBe("approved");
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("approved");
  await page
    .getByRole("textbox", { name: "Note for the author" })
    .fill("Please remove the personal details.");
  await page.getByRole("button", { name: "Unpublish", exact: true }).click();
  await expect(page.getByText("No submissions on this page.")).toBeVisible();
  expect(entry.status).toBe("rejected");
  expect(entry.moderation_note).toBe("Please remove the personal details.");
});
test("ordinary members cannot open the moderation screen", async ({ page }) => {
  await communityFixture(page, false);
  await page.goto("/#/moderation");
  await expect(page.getByRole("alert")).toContainText(
    "This action is for moderators only.",
  );
  await expect(
    page.getByRole("button", { name: "Approve & publish" }),
  ).toHaveCount(0);
});
