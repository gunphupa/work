# Optional account backups

ReBuild still stores inventory and catalogue builds in the browser by default.
The account backup panel offers explicit upload, preview, download, restore and
delete actions. Signing in does **not** upload or replace local data. This is a
manual snapshot transfer, not continuous synchronization or a merge service.

The snapshot includes inventory item photos and private notes, because these are
part of the existing version 1 backup. The panel explains this before upload and
asks for confirmation. External web plans and research records have their own
local exports and are **not uploaded by this feature**. No secrets or research
participant data are added to a backup.

## Owner setup (requires the project's Supabase SQL editor)

1. Open the existing ReBuild Supabase project. Keep its current project URL and
   keys; a new project or paid plan is not required for this feature itself.
2. Run the complete contents of `supabase/private-backups.sql` in SQL Editor.
   It creates a dedicated private table and two RPC functions. It does not modify
   inventory in browsers or any community/research table. The migration is
   repeatable and does not delete existing snapshots.
3. Sign in to ReBuild, open **Account → Account backup**, and click **Check account backup**. No upload occurs yet.
4. Export a local backup first. Upload a small test inventory, sign in on a second
   browser/device, check the account backup, inspect its item/build counts, and
   restore only when ready to replace that device's local inventory/builds.
5. Test with a second account: it must see only its own snapshot. Delete the test
   account backup if no longer needed. Local exports are unaffected.

If the SQL has not been applied, the panel reports that account backups have not
been enabled; local inventory, plans and file exports remain usable. No SQL or
service-role key is exposed in the browser panel.

## Isolation and conflict handling

- A maximum of one snapshot per authenticated account, keyed by `auth.uid()`.
- Row-level security permits authenticated reads of only the current user's row.
  A restrictive owner policy also protects against an accidentally added permissive
  read policy. Anonymous access and direct browser writes are revoked.
- Writes use `save_rebuild_backup(expected_user_id, new_payload, expected_revision)`
  and deletes use `delete_rebuild_backup(expected_user_id, expected_revision)`.
  Ownership always comes from `auth.uid()`. The expected user ID must equal that
  authenticated identity, binding an earlier click to its account even if the
  browser switches accounts before the request is sent.
- Security-definer functions use an empty search path and fully qualified tables.
- Every successful write creates a fresh UUID revision. A stale upload/delete is
  rejected atomically, including deletion/recreation races. The user must reload
  the account snapshot before deciding which version to keep.
- A network error invalidates the panel's loaded revision, because a server write
  might have succeeded before the response was lost.
- An incompatible snapshot with valid owner-scoped metadata cannot be restored,
  but can be downloaded as a recovery JSON file, replaced after confirmation, or
  deleted using its revision. Invalid payloads never replace local data.
- The database rejects payloads larger than 2,000,000 bytes in JSONB text form,
  invalid top-level shapes, more than 500 inventory items or 100 builds. The app
  additionally validates every item, project ID, checklist index and duplicate ID
  using the same strict validator as local imports.
- Deleting a Supabase auth account cascades to its private backup. Normal account
  backup deletion does not delete local data or community submissions.

## Validation and limitations

`tests/cloud-backup-sql.test.ts` executes the real migration twice using local
PostgreSQL (PGlite) with simulated Supabase auth roles. It checks anonymous denial,
owner isolation, direct-write denial, stale revision rejection, invalid sizes and
shapes, and owner-only deletion. `tests/cloud-backup.test.ts` checks client import
validation and metadata/error handling.

`e2e/cloud-backup.spec.ts` uses a clearly mocked account transport to exercise
explicit upload confirmation, preview/restore, revision conflicts, missing-setup
messages, incompatible-backup recovery, accessibility and mobile overflow. All nine checks passed across desktop,
tablet and mobile; these are technical UI checks, not participant research data.

These local tests do not prove that the migration has been installed on the live
Supabase project. Live activation and the two-account/device pilot above remain
owner actions until SQL access is available. Supabase database/storage limits and
availability still apply. A cloud backup is one current snapshot, not a historical
backup archive; keep downloaded files before replacing important data.
