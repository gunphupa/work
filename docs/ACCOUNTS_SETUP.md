# Turn on accounts and moderated community posts

The account and community implementation is included, but it is **not connected to a live Supabase project yet**. Guides and local saved builds work without it. Google sign-in, email delivery, real cloud storage and production moderation still need the live checks below. Do not buy another database or a plugin just to start.

## 1. Create a Supabase project

1. Visit https://supabase.com/ and create an account.
2. Create an organization/project using the Free plan if it meets your needs. Check the current pricing and storage/auth limits in its dashboard; these limits can change. Free projects may pause when inactive.
3. Give it a name such as `rebuild`. Choose a region near your audience. Save the database password securely; ReBuild does not need that password in its environment variables.
4. Wait until the project is ready. Find its Project URL and API keys in the project's Connect dialog or Settings → API/API Keys (dashboard labels may vary).
5. You may share the **Project URL** and your public ReBuild website URL with the coding assistant. Do not paste secret keys, database passwords or Google client secrets into chat.

## 2. Create the community tables and private photo bucket

1. Open the Supabase project's SQL Editor.
2. Open [`supabase/community.sql`](../supabase/community.sql) in this repository, copy its contents into a new query and run it.
3. Run [`supabase/posting-limits.sql`](../supabase/posting-limits.sql) as a second query. It creates durable daily posting counters and a server-only atomic quota function.
4. Confirm the tables `community_entries`, `community_moderators`, `community_decisions` exist and Storage shows `community-photos` as **private**.
5. Do not make that bucket public or grant anonymous/authenticated browser users table writes. ReBuild's server verifies the author, processes the photo and submits the post as pending. Browser roles cannot approve their own posts.

The migration was run twice against local PostgreSQL via PGlite, using simulated Supabase-managed auth/storage tables. Those checks are not a live Supabase deployment test.

## 3. Configure the website host

In Render → your ReBuild service → Environment, add:

| Name | Value | Visibility |
| --- | --- | --- |
| `SUPABASE_URL` | Your project's `https://PROJECT-REF.supabase.co` URL | Public |
| `SUPABASE_PUBLISHABLE_KEY` | The project's publishable key, or legacy `anon` key | Public, intentionally sent to the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | The project's secret key, or legacy `service_role` key | **Server secret only** |
| `APP_ORIGIN` | Your exact website origin, e.g. `https://your-service.onrender.com`, with no trailing slash or path | Public |
| `QUOTA_DB` | For accounts without AI, `/tmp/rebuild-quota.sqlite` is sufficient for the local short-term request throttle. Public AI still requires a persistent volume. | Server configuration |

Never put an elevated secret key in `SUPABASE_PUBLISHABLE_KEY`, a `VITE_*` variable, source code, a screenshot or chat. Never commit `.env`. The browser receives only the URL and publishable key. The server will refuse to expose a recognisable secret/service key as the public key.

Daily community submission counters live in Supabase and survive Render restarts. The database atomically allows 10 submission attempts per verified user and 100 globally per UTC day; failed validation/uploads also consume an attempt. Deleting or unpublishing a post does not refund attempts. A missing migration or database outage rejects submissions (502), with no SQLite fallback. Browser roles cannot access the counters or call the quota function. Old-day counters are removed on the next submission attempt.

The 120 requests/IP/minute community throttle remains local SQLite and may reset on restart; it is distinct from the durable daily posting cap. AI quotas and guest sessions also remain SQLite, so public AI still needs a persistent volume and a single Node instance. No paid plan is needed for this community posting change.

### Upgrade an existing deployment

1. Run `supabase/posting-limits.sql` in Supabase SQL Editor **before** deploying this version. It is repeatable and does not change existing posts, photos or accounts.
2. Deploy the updated server. Existing Supabase environment variables stay the same; on free Render with AI disabled, keep `QUOTA_DB=/tmp/rebuild-quota.sqlite`.
3. Submit a comment. In Supabase Table Editor, check `community_submission_limits`: the current UTC day should have one `global` row and one row for your user UUID.
4. Restart Render, submit another comment, and confirm both counts increase instead of starting over. Test an 11th same-day attempt returns the posting-limit message. Do not clear the live counters to bypass the cap.

Existing temporary SQLite counts are not imported; the first deployment starts fresh Supabase counters for the current day. This is a one-time transition.

For a cloud development environment, enter the same values in its secure environment settings. Allow the exact `PROJECT-REF.supabase.co` hostname for API access. Bind the service secret only to that hostname. A saved configuration draft does not apply itself to a running server; restart after configuration changes. Do not disable TLS verification.

## 4. Configure email sign-in

1. In Supabase Authentication → URL Configuration, set **Site URL** to your real ReBuild origin.
2. Add the exact redirect URL `https://YOUR-SITE/?auth=callback`. Add the equivalent local URL only for development. Do not allow arbitrary wildcard production redirects.
3. Enable the Email provider and keep email verification enabled. ReBuild uses a **passwordless sign-in link** rather than asking people to remember a password.
4. Use an email template with Supabase's normal confirmation URL. Open the link in the same browser where it was requested; the app uses the PKCE flow.
5. Configure production email delivery/SMTP in Supabase before inviting ordinary users. Supabase's built-in mail service has testing restrictions and is not a general production mail service. A mail provider may offer a free allowance; a domain or higher volume may cost money. Check the current limits. Google sign-in does not require this SMTP setup.
6. Test sign-in using an email outside your Supabase team, an expired/used link, and sign-out. A configured key does not prove email delivery works.

## 5. Configure Google sign-in

1. In Google Cloud Console, create or select a project. Configure its Google Auth Platform / OAuth consent screen with the app name, support email and your site details.
2. Request only the basic sign-in scopes: `openid`, `email`, `profile`. ReBuild does not need Google Drive or Gmail access.
3. Create an OAuth client of type **Web application**.
4. Copy the exact callback URL shown by Supabase's Google provider, normally `https://PROJECT-REF.supabase.co/auth/v1/callback`, into the Google client's authorized redirect URIs.
5. Enter the Google Client ID and Client Secret in **Supabase's Google provider settings**, then enable Google. The Google secret does not go in ReBuild's frontend or chat.
6. While Google's app is in testing, add your test users. Complete Google's required consent/publishing steps before opening it to everyone; additional requirements depend on Google's current policies.
7. ReBuild's own redirect remains `https://YOUR-SITE/?auth=callback`. Google's callback and ReBuild's callback are different destinations in this sequence.

## 6. Make your account a moderator

1. Deploy/restart the configured service, open ReBuild and sign in yourself.
2. In Supabase Authentication → Users, find your user and copy its UUID.
3. In SQL Editor run the following with your actual UUID:

```sql
insert into public.community_moderators(user_id)
values ('YOUR-USER-UUID')
on conflict do nothing;
```

4. In ReBuild open Account. The **Open moderation queue** link should appear; reload if needed.
5. Never assign moderator roles from a user-editable display name, email field or profile metadata. Remove a moderator by deleting their row in `community_moderators`.

## 7. Test before inviting users

- In one browser, submit a comment, a photo, a project review and a website review. Each must show **Waiting for approval** in My submissions.
- In a signed-out/private browser, verify that neither the pending text nor its photo is accessible.
- From your moderator account, approve a post. Reload the signed-out browser and confirm it appears.
- Reject a pending submission with a short explanation. Confirm its author can read that explanation but visitors cannot.
- Unpublish a previously approved post. Confirm its photo becomes inaccessible to signed-out visitors too. Already downloaded copies cannot be recalled.
- From an ordinary member account, verify the moderation page and API do not grant approval rights.
- Delete your own submission and confirm the post and stored photo are removed. If storage removal fails, the API removes visibility first and logs `community_photo_cleanup_needed`; administrators should clean orphaned objects in Storage. Auth-user deletion in Supabase also needs storage cleanup because Storage is separate from database foreign keys.
- Verify Google sign-in, external-user email delivery, expired links, sign-out, mobile forms and existing guest backups against the **live deployed origin**.

Reviews may be positive or negative. Reject content for guideline violations rather than low scores. New users cannot appoint themselves moderators. Display names are self-chosen, not unique verified identities. Public posting is currently a flat discussion feed; threaded replies, reporting, notifications, profile pages, automated anti-spam challenges and cloud synchronization of inventory are not included.

A signed-in account's inventory and build notes still live in the current browser. Deleting a cloud submission does not clear those local notes. Users can delete submissions themselves; full account removal currently requires an administrator using Supabase Authentication → Users, plus storage cleanup. Moderation decision records are retained and should follow the site's retention policy before a broad public launch.
