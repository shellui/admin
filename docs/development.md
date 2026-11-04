# Development notes

Detailed notes for people working on this app. The [README](../README.md) has the short version.

Administration UI for Shellui: a React app embedded in the main shell (route `/admin`). This repo is **only the Vite + React app**, with no Shellui shell wrapper.

## Architecture

The admin app runs in two modes:

1. **Chrome** (direct child of the shell `/admin` iframe): sidebar navigation stays in this frame; the main panel is Shellui core [`ContentView`](https://github.com/shellui/shellui) for every menu item (loading overlay + `SHELLUI_URL_CHANGED` sync toward the root shell). Chrome also re-broadcasts parent `SHELLUI_SETTINGS` and `SHELLUI_SETTINGS_UPDATED` into those ContentView frames so theme and language stay in sync. `accessToken` is included only for same-origin admin pages and for URLs marked `safeForAuthToken` (the files explorer and Swagger). Desktop sidebar collapses to icons; on small viewports the menu is a full-page list and each destination opens with a back control (same idea as Shellui Settings on mobile).
2. **Content** (nested same-origin iframe loaded by chrome ContentView): no sidebar; built-in Identity / statistics pages render as normal React routes.

External menus (host custom apps, storage files, Swagger/ReDoc) are opened as absolute URLs inside chrome ContentView. Django admin links remain `target="_blank"`.

## What the panel covers

| Area            | When it appears                                         | Highlights                                                                                                                                                                                                             |
| --------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard**   | Always                                                  | Company-scoped KPIs from identity (`GET /api/v1/metrics`). Optional storage and hosting Prometheus metrics when those services are configured. Email delivery counts from `GET /api/v1/stats` when Email is shown.     |
| **Identity**    | Always (with `backend.url`)                             | Company (incl. magic link toggle), users and invitations, groups, log events, OAuth apps, SCIM, email and webhooks (rules + delivery logs), personal access tokens, statistics; staff Django admin link.               |
| **Storage**     | Host `storage.url` set                                  | Statistics (`GET /storage/v1/stats`); optional Files explorer via `storage.filesUrl`; staff Django admin.                                                                                                              |
| **Hosting**     | Host `hosting.url` set and `showInAdmin` is not `false` | Apps list/detail, statistics, dashboard hosting KPIs (`GET /hosting/v1/metrics`); staff Django admin.                                                                                                                  |
| **Email**       | Host `email.url` set and `showInAdmin` is not `false`   | Last sidebar section: templates, broadcasts, newsletters, provider, allowed link hosts, statistics; staff Django admin. Each service keeps an Email and webhooks page that lists its webhook and email rules together. |
| **Custom apps** | Host `administration` set                               | Extra sidebar links below Dashboard (iframe or external).                                                                                                                                                              |
| **API docs**    | Shell developer mode                                    | Swagger / ReDoc for identity (and storage / hosting when those sections are on).                                                                                                                                       |

## Prerequisites

- [pnpm](https://pnpm.io/) (see `packageManager` in `package.json`)

## Development

From this directory, install once and start the dev server:

```bash
pnpm install
pnpm start
```

This runs the app on **http://localhost:5173** (see `vite.config.ts`).

If you open that URL **directly in a browser**, you will see a short message: the admin UI is meant to load **inside an iframe** from the main Shellui app. Configure the main app's `shellui.config.json` (or `shellui.config.ts`) with `backend.adminUrl` pointing at this URL, then open **`/admin`** in the shell (as a staff user or company owner).

**Run together with the main Shellui app**

1. Terminal A - main Shellui repo: `pnpm start` → e.g. `http://localhost:4000`
2. Terminal B - this repo: `pnpm start` → `http://localhost:5173`

In the main app, set:

```ts
backend: {
  // …
  adminPathname: '/admin',
  adminUrl: 'http://localhost:5173',
},
```

Optional services the admin panel picks up from SDK settings:

```ts
storage: {
  url: 'http://localhost:8002',
  filesUrl: 'http://localhost:5175/', // optional Files explorer entry
},
hosting: {
  url: 'http://localhost:8003',
  // showInAdmin: false, // hide Admin → Hosting while keeping deploy
},
email: {
  url: 'http://localhost:8004',
},
aiService: {
  url: 'http://localhost:8006',
},
```

Admin reads service URLs from SDK settings (host `shellui.config`) first. In **dev builds only**, it can fall back to `VITE_*` env vars when a URL is missing (see [.env.example](../.env.example)). Production nginx images still rely on the shell; nothing is baked in at build time unless you set `VITE_*` during `pnpm build` (avoid that for production).

Staff open Django admin for Email at the `email.url` origin plus `/admin/`.

### Shared local dev stack (Docker Compose)

The Shellui monorepo ships a compose file under `dev/docker-compose.yml` that builds sibling repos with `target: dev`, bind-mounts source at `/app`, and keeps `node_modules` in an anonymous volume for Vite apps.

For Admin alone:

```bash
docker build --target dev -t shellui-admin:dev .
docker run --rm -p 5173:5173 \
  -v "$PWD:/app" -v /app/node_modules \
  -e VITE_IDENTITY_URL=http://localhost:8001 \
  -e VITE_STORAGE_URL=http://localhost:8002 \
  -e VITE_HOSTING_URL=http://localhost:8003 \
  -e VITE_EMAIL_URL=http://localhost:8004 \
  -e VITE_AI_SERVICE_URL=http://localhost:8006 \
  shellui-admin:dev
```

Typical stack host ports: identity `8001`, storage `8002`, hosting `8003`, email `8004`, ai `8006`, admin `5173`, files `5175`.

| Variable                                                          | Purpose                                                                       |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `VITE_IDENTITY_URL`                                               | identity-service (maps to shell `backend.url`)                                |
| `VITE_STORAGE_URL`                                                | storage-service                                                               |
| `VITE_HOSTING_URL`                                                | hosting-service                                                               |
| `VITE_EMAIL_URL`                                                  | email-service                                                                 |
| `VITE_AI_SERVICE_URL`                                             | ai-service (`aiService.url`)                                                  |
| `VITE_FILES_URL`                                                  | optional Files explorer origin (`storage.filesUrl`)                           |
| `VITE_DEV_SERVER_PORT` / `VITE_HMR_CLIENT_PORT` / `VITE_HMR_HOST` | HMR through the published Docker port (defaults: `5173`, `5173`, `localhost`) |
| `VITE_USE_POLLING` or `CHOKIDAR_USEPOLLING`                       | File watching on bind mounts (macOS)                                          |

Run the full stack from the Shellui repo: `cd shellui/dev && ./start.sh`. See the [Shellui dev stack guide](https://github.com/shellui/shellui/blob/develop/docs/dev-stack.md).

## Identity company admin (SCIM, magic link, webhooks)

Point `backend.url` at a local or deployed **identity-service** (for example `http://localhost:8001` in the shared dev stack). Sign in through Shellui as a **company owner** so the JWT includes `company_id` and `user_metadata.is_company_owner`.

| Route                            | API                                                                                                                                                                                                                     |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `#/scim`                         | `GET /api/v1/scim`, token CRUD under `/api/v1/scim/tokens`                                                                                                                                                              |
| `#/company`                      | `GET/PATCH /api/v1/auth-methods` (`enable_magic_link`, read-only global kill switch)                                                                                                                                    |
| `#/identity/webhooks`            | Identity email and webhooks (sidebar: Identity → Email and webhooks). One list of webhook and email rules, ordered by event then created date. Webhook API on **identity-service**. Email rules call **email-service**. |
| `#/email/templates`              | Company theme (Barebone, Matte, Protocol, Arcane, Studio) and the company template list. Open a template by id to edit subject, preheader, and blocks.                                                                  |
| `#/email/provider`               | Company provider (Resend or Amazon SES). SMTP stays disabled when `smtp_allowed` is false. Untouched optional fields are omitted on save. The API key is write-only.                                                    |
| `#/email/statistics`             | Delivery stats (including skipped events) and Prometheus metrics from email-service.                                                                                                                                    |
| `#/hosting/webhooks`             | Hosting email and webhooks when `hosting.url` is set. Same combined rule list as identity. Webhooks call **hosting-service** `/api/v1/actions/*`.                                                                       |
| `#/storage/webhooks`             | Storage email and webhooks when `storage.url` is set. Same combined rule list as identity. Webhooks call **storage-service** `/api/v1/actions/*`.                                                                       |
| `#/identity/webhooks/deliveries` | Delivery log for the active service (`GET /api/v1/actions/deliveries`, detail + `POST …/requeue`).                                                                                                                      |
| `#/email/webhooks`               | Email-service email and webhooks when `email.url` is set. Same combined rule list as identity.                                                                                                                          |
| `#/email/broadcasts`             | Broadcasts: compose, preview and send a one-off email to a newsletter audience.                                                                                                                                         |
| `#/email/newsletters`            | Newsletters, their subscribers, the sign-up form, the confirmation email and settings (name, language, allowed websites, Turnstile).                                                                                    |
| `#/email/link-hosts`             | Allowed link hosts for sign-in links: effective list, extra hosts (editable), application and platform hosts (read-only).                                                                                               |

Legacy `#/webhooks` and `#/actions/...` redirect to `#/identity/webhooks/...`, `#/access-tokens` to `#/personal-access-tokens` and `#/login-events` to `#/events`.

In the Shellui shell, the address bar uses path URLs (for example `/admin/storage/webhooks`); the admin chrome maps those to the same hash routes above.

The webhooks UI lives in **`src/features/actions/`** with a shared `ActionsApiClient` in `src/lib/actionsApi.ts`. The client takes a service base URL (identity, hosting, or storage) and sends the same Shellui access token (`Authorization: Bearer …`) and `company_id` query parameter identity already uses.

If a service does not yet expose webhook endpoints (404), the UI shows a "Webhooks API is not available on this service version" banner for that tab only.

## OAuth setup and redirect allowlist

Under **Identity → OAuth apps**, company owners manage social login providers and the **OAuth redirect allowlist** (`/api/v1/oauth-redirects`):

- Register a **single** provider callback on identity-service: `{identity}/api/v1/oauth/callback` (not the shell `/login/callback` route).
- Allow each shell origin that may receive the post-login bounce. Loopback (`127.0.0.1` / `localhost`) is always allowed for CLI login.
- Hosting-managed preview origins appear in a separate list (synced on `shellui deploy` / hosting project delete). App detail warns when a site origin is missing from the allow list and offers a one-click add for company owners.

## Build & preview

```bash
pnpm build
pnpm preview
# or serve the static folder:
pnpm serve:dist
```

Production deploy (GitHub Pages) outputs the site at the **root** of the domain (for example **https://admin.shellui.com/**). Set the main app’s `adminUrl` to that origin.

## Docker image

Each published release is pushed to Docker Hub as `shellui/admin` (tags `X.Y.Z`, `X.Y`, and `latest` for the highest stable release only). The image is multi-arch (amd64 and arm64), serves the static build with unprivileged nginx on port `8080`, and has a built-in healthcheck on `/health`.

```bash
docker run -p 8080:8080 -e FRAME_ANCESTORS="https://dashboard.shellui.com" shellui/admin:latest
```

The image holds no secrets and no region-specific URLs. Identity, email, storage and hosting URLs come from the host shell config at runtime, so the same image works in every region.

| Variable          | Required          | Description                                                                                                                                                                                                                                                     |
| ----------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FRAME_ANCESTORS` | Yes in production | Space-separated exact origins allowed to embed the app (the dashboard shell of each region). Sets the `frame-ancestors` CSP header. Each entry must be `'self'` or an `http(s)` origin. A bare `*` is refused. When unset, only same-origin framing is allowed. |

Releases are published by `.github/workflows/publish.yml`. It needs the `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` repository secrets (a Read & Write token for the `shellui` namespace). A manual run only moves `latest` when it publishes the highest stable tag.

## Custom navigation from the host shell

The host app can inject extra sidebar links via top-level `administration` in config (title + flat `navigation` items). The shell propagates them through SDK settings; this admin app renders them **below Dashboard**. See the Shellui docs page **Administration panel**.

Set `safeForAuthToken: true` on an administration item to share the session access token with that iframe. The shell must copy that flag onto `settings.administration.navigation[]`. Without the flag, the iframe still receives theme and language, and `accessToken` is null.

## Company access

On the **Company** page, company owners set the join mode: public, domain allow list, or invitation only. In the **Identity directory** (Users), the Company access switch turns access on or off for **this company only** (`CompanyMembership.is_enabled` via `PUT /api/v1/users/<id>`). Invite user and Pending invitations open as shell modals (`#/invite`, `#/invitations`). `is_staff` and `is_superuser` are changed in Django admin only.

## Tests

```bash
pnpm test
pnpm typecheck
pnpm format:check
```

Pull requests (and pushes to `develop` / `main`) run the same checks plus production build, secret scan, dependency audit, brand/secret hygiene, markdown link check, and CodeQL. GitHub Pages deploy still runs only after merge to `main`. Require those CI jobs in branch protection before merging.

## Structure

| Path                   | Role                                                                         |
| ---------------------- | ---------------------------------------------------------------------------- |
| `src/`                 | Vite + React source                                                          |
| `public/`              | Static files copied to `dist/` (including `CNAME` for **admin.shellui.com**) |
| `tools/serve/serve.js` | Optional local static server after `pnpm build`                              |
