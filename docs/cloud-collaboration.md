# Cloud collaboration

Codex Taskboard can run as a small shared Cloudflare deployment for two trusted collaborators:

- one Worker serves the built UI and the JSON API;
- D1 is the authoritative business database;
- a private R2 bucket stores attachments;
- one SQLite-backed Durable Object broadcasts revision changes over hibernating WebSockets;
- UI, API, and attachment routes use HTTPS Basic Authentication; `/health` is public;
- open boards refresh when a revision event arrives; reconnects perform one revision check and never poll periodically.

The production resource names are:

| Resource | Name |
| --- | --- |
| Worker | `board` |
| D1 database | `codex-taskboard-db` |
| R2 bucket | `codex-taskboard-attachments` |
| Durable Object class | `RealtimeHub` |

This is intentionally a shared-password trust model. The Basic username is only the actor name displayed in task and comment attribution, not a verified identity. Anyone who knows the shared password has full read and write access and can choose any actor name. Use it only with the other trusted collaborator.

## Cloud data and device execution

The cloud stores projects, issues, comments, relations, attachments, registered devices, and each device's project-directory mappings. Device-specific paths are visible to trusted authenticated board collaborators; they are not stored as the shared project's single workspace path.

Each computer authenticates directly through `taskctl`, registers a device record, and saves its own project directories under that device in D1. Credentials stay in its private ignored `.data/cloud-device.json`. The native Codex app executes code locally without a second Taskboard panel.

Cloud business data has one authoritative source. Failed cloud requests are reported rather than falling back to local SQLite. Logging out clears this CLI's cloud session; it does not merge local and cloud data.

## Owner: validate locally

Install dependencies and build the frontend:

```bash
npm ci
npm run build:web
```

Create an ignored `.dev.vars` file containing a local-only value for `TASKBOARD_SHARED_SECRET`, apply the D1 migration to Wrangler's local state, and start the Worker:

```bash
npm run cloud:migrate:local
npm run dev:cloud
```

Open the printed loopback URL. The browser shows the page login form. Enter any local actor name as the display name and the value from `.dev.vars` as the password.

Local Wrangler state lives under `.wrangler/` and is not committed.

## Owner: deploy

Authenticate Wrangler first:

```bash
npx wrangler login
npx wrangler whoami
```

Provision the production D1 database and private R2 bucket using the exact names above.

```bash
npx wrangler d1 create codex-taskboard-db
npx wrangler r2 bucket create codex-taskboard-attachments
```

`wrangler.jsonc` contains one production configuration and identifies the D1 binding by its resource name and `database_id`. A D1 database ID is public metadata and does not grant access, so it can be committed. Wrangler local development creates persistent local equivalents under `.wrangler/`; those are local simulations, not additional Cloudflare environments.

Apply the remote D1 migration and validate the deployment bundle:

```bash
npm run cloud:migrate
npm run cloud:deploy:dry-run
```

Set the shared password through Wrangler's private interactive prompt after the database schema is ready. Do not put the value in `wrangler.jsonc`, a shell command, a log, or a committed file. Then deploy the production Worker:

```bash
npx wrangler secret put TASKBOARD_SHARED_SECRET
npm run cloud:deploy
```

These commands create or update Cloudflare resources. This repository contains the production D1 database ID for the binding, but it does not contain the shared password or any API or OAuth token. Keep those credentials out of Git; cloning the repository does not grant access or mean the Worker has already been deployed.

Give the other collaborator the deployed Worker HTTPS origin and shared password through a trusted channel. Never publish the password in the repository, an issue, or logs.

Current Cloudflare references:

- [Workers Static Assets binding](https://developers.cloudflare.com/workers/static-assets/binding/)
- [Durable Objects with WebSocket Hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Create an R2 bucket](https://developers.cloudflare.com/r2/buckets/create-buckets/)
- [Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)

## Device: connect directly to the cloud board

Use the deployed Worker as the only panel. Install the `manage-taskboard` skill on the computer that will execute work. Each computer logs into the same board and registers its own device:

```bash
npm run taskctl -- cloud login \
  --url https://YOUR-WORKER-ORIGIN \
  --actor-name "YOUR-DISPLAY-NAME" \
  --device-name "MY-COMPUTER"
npm run taskctl -- cloud status
npm run taskctl -- device current
npm run taskctl -- project list
```

Enter the board password only at the private `Shared key:` prompt. No local server or local panel needs to be started. The CLI stores the credentials in its ignored `.data/cloud-device.json` with mode `0600` and sends the existing password only in the HTTPS Basic Authorization header. Login returns a cloud `boardUrl` that selects the registered device.

When cloning or choosing a project on this device, register its real checkout:

```bash
npm run taskctl -- project map PROJECT_ID \
  --workspace-path /absolute/path/on/this/device
```

Device records and project paths are stored in D1. Paths are scoped by device ID and can differ between computers. They are visible to trusted authenticated board collaborators; a device record is not a separate authentication boundary.

In the cloud panel, open the project menu and choose **当前设备与项目目录 / This device and project folders**. Select the computer currently in use, choose a project, and view or edit its full checkout path. The selected device is remembered in this browser.

Open a task and click **在新对话打开 / Open in new conversation**. The cloud panel opens the native Codex app with that device's project directory, task identifier, and exact CLI path. Send the prepared message to start execution. The skill claims the task and writes comments and status directly to the cloud; user acceptance controls completion.

The browser uses a page login form with the same actor display name and board password. Successful login creates the existing signed HttpOnly Secure session cookie; it does not trigger a native browser password dialog. The CLI and browser each keep their own credential session; both authenticate to the same cloud service. The cloud cannot read files or execute code on the computer: execution remains in its native Codex app. This path does not provide browser-side Git scans or local AI chat.

## Local mode

The existing local panel and companion remain available for local-only installations and explicitly selected launcher runtimes. They are not a prerequisite for the cloud workflow above.

## Rotate or revoke the shared password

The owner rotates the Worker secret using Wrangler's interactive prompt:

```bash
npx wrangler secret put TASKBOARD_SHARED_SECRET
```

After rotation, registered devices rerun `taskctl cloud login` and enter the new password. Browser-only users must authenticate again; closing the authenticated browser session or clearing site authentication may be necessary because browsers cache Basic credentials.

Because both collaborators share one password, rotation affects both at once. There is no individual-user revocation in this two-person trust model.

## Advanced: one-time import of existing local data

The migration tool takes a consistent SQLite snapshot with `VACUUM INTO`, removes structured device-only paths, exports attachment hashes, and writes a private bundle. The default local paths are:

```bash
npm run cloud:data -- export \
  --database .data/taskboard.sqlite \
  --attachments .data/attachments \
  --output cloud-migration-exports/initial
```

The output directory contains issue content and attachment bytes. It is mode-restricted and ignored by Git, but it must still be handled as private data. This export is optional when starting with an empty cloud board.

Before importing, authenticate Wrangler, provision the named D1 and R2 resources, and run `npm run cloud:migrate` so the remote D1 schema exists. The target D1 must contain no projects, and none of the bundle's attachment keys may already exist in R2. Import refuses a non-empty target instead of merging or overwriting it.

Run the one-time Wrangler adapter with an explicit remote-operation acknowledgement:

```bash
TASKBOARD_MIGRATION_REMOTE=1 npm run cloud:data -- import \
  --bundle cloud-migration-exports/initial \
  --adapter ./scripts/wrangler-cloud-adapter.mjs

TASKBOARD_MIGRATION_REMOTE=1 npm run cloud:data -- verify \
  --bundle cloud-migration-exports/initial \
  --adapter ./scripts/wrangler-cloud-adapter.mjs
```

`TASKBOARD_MIGRATION_REMOTE=1` is a deliberate safety gate for these two commands. The adapter uses the current Wrangler login and the production resource names from `wrangler.jsonc`; it does not add a migration HTTP endpoint or store Cloudflare credentials. The commands are not run automatically by deployment, so having the repository does not mean data has already been imported.

The adapter has a local-persistence integration test that does not access remote Cloudflare resources:

```bash
node --test test/cloud-migration.test.mjs
```
