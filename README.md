# Shellui Admin

Administration UI for Shellui: a React app embedded in the main shell (route `/admin`). This repo is **only the Vite + React app**—no Shellui shell wrapper.

**Current release:** [0.4.0](./CHANGELOG.md) · production origin **https://admin.shellui.com/**

## Architecture

The admin app runs in two modes:

1. **Chrome** (direct child of the shell `/admin` iframe): sidebar navigation stays in this frame; the main panel is Shellui core [`ContentView`](https://github.com/shellui/shellui) for every menu item (loading overlay + `SHELLUI_URL_CHANGED` sync toward the root shell). Chrome also re-broadcasts parent `SHELLUI_SETTINGS` / `SHELLUI_SETTINGS_UPDATED` into those ContentView frames so nested apps keep theme and settings in sync live. Desktop sidebar collapses to icons; on small viewports the menu is a full-page list and each destination opens with a back control (same idea as Shellui Settings on mobile).
2. **Content** (nested same-origin iframe loaded by chrome ContentView): no sidebar; built-in Identity / statistics pages render as normal React routes.

External menus (host custom apps, storage files, Swagger/ReDoc) are opened as absolute URLs inside chrome ContentView. Django admin links remain `target="_blank"`.

## What the panel covers

| Area            | When it appears                                         | Highlights                                                                                                                                     |
| --------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard**   | Always                                                  | Company-scoped KPIs from identity (`GET /api/v1/metrics`). Optional storage and hosting Prometheus metrics when those services are configured. |
| **Identity**    | Always (with `backend.url`)                             | Company, users, groups, login events, OAuth apps, personal access tokens; staff Django admin link.                                             |
| **Storage**     | Host `storage.url` set                                  | Statistics (`GET /storage/v1/stats`); optional Files explorer via `storage.filesUrl`; staff Django admin.                                      |
| **Hosting**     | Host `hosting.url` set and `showInAdmin` is not `false` | Apps list/detail, statistics, dashboard hosting KPIs (`GET /hosting/v1/metrics`); staff Django admin.                                          |
| **Custom apps** | Host `administration` set                               | Extra sidebar links below Dashboard (iframe or external).                                                                                      |
| **API docs**    | Shell developer mode                                    | Swagger / ReDoc for identity (and storage / hosting when those sections are on).                                                               |

## Prerequisites

- [pnpm](https://pnpm.io/) (see `packageManager` in `package.json`)

## Development

From this directory, install once and start the dev server:

```bash
pnpm install
pnpm start
```

This runs the app on **http://localhost:5174** (see `vite.config.ts`).

If you open that URL **directly in a browser**, you will see a short message: the admin UI is meant to load **inside an iframe** from the main Shellui app. Configure the main app’s `shellui.config.json` (or `shellui.config.ts`) with `backend.adminUrl` pointing at this URL, then open **`/admin`** in the shell (as a staff user or company owner).

**Run together with the main Shellui app**

1. Terminal A — main Shellui repo: `pnpm start` → e.g. `http://localhost:4000`
2. Terminal B — this repo: `pnpm start` → `http://localhost:5174`

In the main app, set:

```ts
backend: {
  // …
  adminPathname: '/admin',
  adminUrl: 'http://localhost:5174',
},
```

Optional services the admin panel picks up from SDK settings:

```ts
storage: {
  url: 'http://localhost:8001',
  filesUrl: 'http://localhost:5175/', // optional Files explorer entry
},
hosting: {
  url: 'http://localhost:8002',
  // showInAdmin: false, // hide Admin → Hosting while keeping deploy
},
```

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

## Custom navigation from the host shell

The host app can inject extra sidebar links via top-level `administration` in config (title + flat `navigation` items). The shell propagates them through SDK settings; this admin app renders them **below Dashboard**. See the Shellui docs page **Administration panel**.

## Company access

**Organization** (company owners) can set join mode: public, domain allow list, or invitation only. The **Users** directory Enable / Disable actions toggle access for **this company only** (`CompanyMembership.is_enabled` via `PUT /api/v1/users/<id>`).

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

## License

MIT
