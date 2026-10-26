# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

<!---
## [Unreleased] - yyyy-mm-dd

### ✨ Feature – for new features
### 🛠 Improvements – for general improvements
### 🚨 Changed – for changes in existing functionality
### ⚠️ Deprecated – for soon-to-be removed features
### 📚 Documentation – for documentation update
### 🗑 Removed – for removed features
### 🐛 Bug Fixes – for any bug fixes
### 🔒 Security – in case of vulnerabilities
### 🏗 Chore – for tidying code

See for sample https://raw.githubusercontent.com/favoloso/conventional-changelog-emoji/master/CHANGELOG.md
-->

## [0.7.0] - yyyy-mm-dd

### ✨ Feature

- **Email and webhooks for email:** a new Email and webhooks page for email-service, with a newsletter filter on webhook and email rules. Needs shellui/email-service#19.
- **Newsletter metadata:** the subscribers list shows the details sent with each sign-up. Needs shellui/email-service#19.

## [0.6.9] - 2026-10-25

### ✨ Feature

- **Amazon SES:** the email provider form supports Amazon SES. Needs email-service with SES support (shellui/email-service#16).
- **Default provider quota:** projects without a provider see the Shellui default provider limits and today's use. Needs shellui/email-service#18.

## [0.6.8] - 2026-10-24

### 🐛 Bug Fixes

- A 401 asks the shell for a fresh token and retries once. A second 401 shows "session expired" in the page instead of navigating.
- Page errors and unknown routes show inline, so the admin layout and its frames stay mounted. Retry no longer reloads.
- Content frame skips echoes of its own navigation, so fast redirects no longer bounce.
- Files embedded in admin gets admin's `storage` settings, fixing "Storage URL is not set" inside the dashboard.

## [0.6.7] - 2026-10-24

### ✨ Feature

- **Docker:** Publishes a `shellui/admin` image to Docker Hub on each release, configured at runtime with `FRAME_ANCESTORS`.

### 🐛 Bug Fixes

- **Token refresh:** A token renewal for the same user no longer reloads pages and remounts their forms, which made password managers like 1Password pop up every few minutes.

## [0.6.6] - 2026-10-24

Requires an explicit `email.url` in the host shell config, and shellui 0.7.0-alpha.6 when admin runs inside the dashboard frame.

### 🐛 Bug Fixes

- **Embedded shell:** Admin reads identity URL and session token per frame, and a production build errors instead of calling localhost when `backend.url` is missing.

### 🔒 Security

- **Embedded apps:** Admin no longer forwards `accessToken` to nested frames unless they are same-origin admin pages or marked `safeForAuthToken`.
- **Email:** No built-in `email.shellui.com` fallback; Email is hidden when the shell sends no `email.url`.
- **Dependencies:** zod 4.6 (with `@hookform/resolvers` 5) and happy-dom 21.0.4 fix high advisories.

### 🏗 Chore

- **Dependencies:** Bumps react-router-dom, @radix-ui/react-slot, svgo, jsdom and lint-staged.

## [0.6.5] - 2026-10-21

### 🏗 Chore

- **Shellui SDK:** Uses `@shellui/sdk` 0.7.0-alpha.1, pinned exactly.
- Requires identity-service 0.9.0 and shellui 0.7.0-alpha.1.

## [0.6.4] - 2026-10-19

### 🐛 Bug Fixes

- **Files:** The Files app loads inside admin again.

### 🔒 Security

- **Embedded apps:** Admin trusts messages only from the Files app and custom admin apps it embeds.

## [0.6.3] - 2026-10-18

Requires identity-service 0.8.2.

### Desktop sign-in schemes

- Owners and staff can allow dev builds (`-dev` schemes) for listed desktop apps.

### Dependencies

- Uses `@shellui/sdk` 0.6.2.

## [0.6.2] - 2026-10-13

Requires identity-service 0.8.1.

### Desktop sign-in schemes

- Desktop sign-in schemes move onto the company. Owners and staff edit the list, and an empty list turns desktop sign-in off.

### Shell session

- Admin asks the shell for a session again when the tab is shown and the access token is missing or expires within 90s.

### Sidebar

- Every Django admin link in the sidebar uses the same icon.

## [0.6.1] - 2026-10-13

Requires identity-service 0.8.0 for the desktop scheme field.

### Desktop sign-in scheme

- Company owners and staff set a desktop sign-in scheme on an OAuth application.

### Email Django admin

- Staff see a Django admin link for Email.

### Identity statistics

- Identity Statistics moves to the end of Identity, before Django admin.

### Sidebar

- The admin version number shows at the bottom of the sidebar.

## [0.6.0] - 2026-10-12

Requires identity-service 0.7.0, hosting-service 0.6.1, storage-service 0.5.0, and email-service 0.2.0.

### Identity statistics

- Identity Statistics shows company user counts, active users, and successful sign-ins by provider since the identity-service process started.

### Allowed link hosts

- Allowed link hosts, under Email, lists auth-mail hostnames and lets you add or remove extra hostnames for the company.
- Application hosts synced from identity stay read-only.

### Scheduled jobs

- Staff see scheduled-job health on the Identity, Hosting, Storage, and Email statistics pages.
- The dashboard no longer shows scheduled-job health.
- Email shows `retry_webhooks`, `sweep_email_queue`, and `purge_expired_data`.

## [0.5.0] - 2026-10-07

Requires identity-service 0.7.0, hosting-service 0.6.1, storage-service 0.5.0, and email-service 0.1.0.

### Webhooks

- Company owners manage webhook rules and delivery logs for identity, storage, and hosting.
- Legacy `#/actions` paths redirect to the webhooks pages.
- A signing secret is shown once when it is created or rotated, and later reads return only a hint.

### Email service

- Admin calls email-service with the identity JWT. The default origin is `https://email.shellui.com`, or `email.url` from the host config.
- The Email section has a template library, provider settings, statistics, broadcasts, and newsletters.
- An event email is written once, translated in place, and painted with a Shellui theme.
- Preview and draft send use catalog example values. Auth templates reject a literal sign-in URL.
- Provider saves omit untouched credentials. The API key is write-only.

### Scheduled jobs

- Staff see identity scheduled job health on the dashboard. Company owners do not.
- `retry_webhooks` and `purge_expired_data` run on each service's built-in scheduler.

### SCIM

- Company owners create a SCIM token, see the secret once, and revoke it.

### Users and invitations

- Company owners and staff invite people, review pending invitations, and remove a user from the company.
- Staff and superuser flags are not editable here. They stay in Django admin.

### Log events

- Identity, storage, and hosting each have a log events list and a detail page.
- The dashboard and the log pages warn when stored events are older than the company retention period.

### OAuth apps

- Company owners set up sign-in providers from the catalog, with the callback URL and the redirect allowlist.

### Dependencies

- Uses `@shellui/sdk` 0.6.0. Host email settings come from the typed `settings.email` block, and a missing `url` still falls back to `https://email.shellui.com`.
- React 19.3, tailwind-merge 3.7, `@radix-ui/react-slot` 1.3.3, and autoprefixer 10.6.1 are included from `main`.

### Security

- Email HTML preview runs in a sandboxed iframe.
- Access tokens stay in memory and are sent as `Authorization` headers.
- `pnpm.overrides` keeps `source-map-js` at 1.2.2 or newer.

## [0.4.0] - 2026-09-07

### ✨ Feature

- **Hosting metrics on dashboard:** when hosting is enabled (`hosting.url` / `showInAdmin`), the operations overview loads company-scoped KPIs from `GET /hosting/v1/metrics` (same staff / company-owner gate as identity and storage).
- **OAuth redirect allowlist:** OAuth setup shows the identity-service callback URL to register on each provider app, plus per-company allowed shell origins (`/api/v1/oauth-redirects`) so token bounces are restricted to approved hosts (loopback always allowed for CLI).
- **Hosting preview redirects:** OAuth setup shows hosting-managed origins in a separate list (auto-synced on `shellui deploy` / hosting project delete). Hosting app detail warns when the site origin is missing from the allow list and offers a one-click add for company owners.

### 🔒 Security

- **PR CI:** pull requests and `develop`/`main` run format, TypeScript, Vitest, production build, gitleaks, production dependency audit, brand/secret hygiene, markdown link check, and CodeQL. GitHub Pages deploy stays on push to `main` only.
- **react-router:** bump to patched 7.18.x (DoS / RCE / CSRF advisories on 7.0–7.18.1).

### 🚨 Changed

- Provider callback URL helper now points at identity-service (`{identity}/api/v1/oauth/callback`) instead of the shell `/login/callback` route.

### 📚 Documentation

- README covers hosting / storage gating, dashboard metrics sources, OAuth redirect allowlist, and the 0.4.0 release pointer.
- In-app and code comments prefer `shellui.config.json` (with optional `.ts`) for host config references.

## [0.3.0] - 2026-08-31

### ✨ Feature

- **Responsive chrome:** desktop sidebar collapses to an icon rail with shadcn tooltips for labels (persisted); on mobile the nav is a full-page menu and opening an item shows content with a back button (Settings-style)

### 🐛 Bug Fixes

- **Nested ContentView settings:** admin chrome re-broadcasts `SHELLUI_SETTINGS` / `SHELLUI_SETTINGS_UPDATED` from the parent shell into ContentView iframes so theme (and other settings) update live without a refresh
- **Dashboard metrics:** changing shell settings (e.g. theme) no longer refetches Prometheus KPIs or flashes the loading state; metrics reload only when the session token or storage base URL changes

## [0.2.0] - 2026-08-16

### ✨ Feature

- **Administration navigation:** host apps can inject custom sidebar links via `administration` in `shellui.config.ts`, rendered below Dashboard (iframe embed or external open)
- **Company access:** Organization panel configures join mode (public / domain allow list / invitation only) and allowed email domains.
- **Storage statistics:** when the host sets root `storage.url`, Admin shows a Storage sidebar with Statistics (`/storage/statistics`) from `GET /storage/v1/stats` (and staff Django admin for that service). Optional `storage.filesUrl` adds a hardcoded Files explorer entry (`/storage`).

### 🗑 Removed

- Hard-coded Storage Explorer / always-on Storage nav, and Files as a generic `administration.navigation` item. Storage UI is gated on SDK `settings.storage` from the host config.

## [0.1.0] - 2026-05-14

### ✨ Feature

- **Session:** use the shell **JWT access token** for **shellui-auth** API calls, with **backend URL** hydration from SDK settings
- **Dashboard:** staff **auth metrics** KPIs for total, active, and staff users, linked social accounts, and **DAU** / **WAU** / **MAU** activity
- **Metrics exposition:** preview **Prometheus** text and link to the staff metrics endpoint for the signed-in company
- **Company:** **company owners** can view and rename the current company
- **Users:** searchable, paginated directory with avatars, groups, owner and active flags, username, and last seen; **user detail** with profile fields, editable **group membership**, stored **Shellui preferences**, and lazy-loaded per-user **login history**
- **Groups:** create, rename, and delete company groups
- **OAuth apps:** **company-owner** management of social login providers with create, update, and delete flows, **callback URL** helper with copy, **Microsoft tenant** support, and unsaved-change confirmation through shell **dialogs**
- **Login events:** filterable **audit log** by outcome, provider, location, timezone, staff flag, and language, plus paginated **event detail** with related events for the same user
- **Access tokens:** create **personal access tokens** with optional **read-only** scope, staff-only **global metrics** access, one-time token reveal, and revoke
- **API docs:** embedded **Swagger** and **ReDoc** views of the auth backend OpenAPI docs in **developer mode**
- **Developer mode:** **Swagger** and **ReDoc** nav entries and routes appear only when shell **developer features** are enabled
