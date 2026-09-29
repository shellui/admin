# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased] - 2026-09-26

### 🚨 Changed

- **Webhooks admin:** renamed the Actions UI to Webhooks (`#/webhooks`, `#/webhooks/deliveries`) with redirects from legacy `#/actions/...` routes. Webhook rules only; aligned with identity-service webhook-only rules API (`sample_envelope`, `POST …/send-test`, no `action_kind` on create).

### 🔒 Security

- Action email preview substitution matches identity: HTML-escape interpolated values; scheme-check URL attributes; plain mode for subjects.

### 🛠 Improvements

- Action email editor canvas styles `.align-center` / `.align-left` / `.align-right` so TipTap button wrappers match preview/export alignment (React Email theme only styled `[alignment="…"]` attributes).
- Template variable chips insert at the caret (mousedown no longer steals editor focus; last TipTap selection is restored). Subject and JSON mode also insert at the text caret.
- Action email editor accepts `{{ … }}` placeholders in button/link/image href fields (React Email’s URL validator previously cleared them). URL variable chips expose Link / Btn actions and set the href when a button is selected.
- Action email theme uses React Email **basic** base (not minimal) with padded CTAs, container inset, and barebones-like spacing so buttons are no longer flat colored strips in the editor/preview.
- Admin fallback welcome HTML matches the padded card + CTA button styling used by identity defaults.
- React Email editor canvas is constrained in narrow admin columns (`min-w-0` grid + `.node-container { max-width: 100% }`) so text no longer overflows the frame; preview iframe wraps long URLs.
- Email HTML preview substitutes identity **sample data** (company name + catalog examples, including `magic_link_url`) with a Sample data / Placeholders toggle and a rendered subject line.

### 🚨 Changed

- Action email defaults from identity are JSON documents only (no HTML). The editor compiles HTML for EN and FR on save and stores it on the rule; identity rejects email rules without compiled HTML. Legacy rules without stored HTML load the default document — save them once to compile.

### ✨ Feature

- Action email editor **Send test to myself**: compiles the active locale, posts to identity `…/email-template/send-test` (staff/owner, rate-limited), and toasts the recipient.
- **SCIM admin:** company owners configure SCIM base URL, create bearer tokens (secret shown once), and revoke active tokens (`#/scim`).
- **Magic link toggle:** company owners enable or disable magic link sign-in on `#/company`, with read-only global kill switch and effective status from `GET/PATCH /api/v1/auth-methods`.
- **Actions module:** reusable `src/features/actions/` UI with rules list/editor (email + webhook), delivery logs + detail/requeue, and TipTap WYSIWYG email templates (en/fr) with iframe preview (`#/actions/rules`, `#/actions/deliveries`).

### 🛠 Improvements

- Action rule create (email): selecting an event auto-loads EN/FR default templates from identity (`/api/v1/actions/events/<event_type>/email-template`, with query-param fallback).
- Email editor placeholder chips parse `payload_fields`, email context fields, and envelope vars from the events catalog (including URL vars like `data.magic_link_url` with one-click link/button insert).
- TipTap email editor adds a shared style strip (brand color, button styling, preview width/layout) with inline styles baked into saved HTML for Django send.
- Action email editor adds **Reset to default** to reload EN/FR templates from event filesystem defaults via the by-event API.

### 🐛 Bug Fixes

- Identity admin API clients accept documented `{ results: [...] }` list envelopes and field names (`event_type`, `action_kind`, SCIM token `name`/UUID `id`, delivery UUIDs).

### 🔒 Security

- Email HTML preview/export sanitizes TipTap output with DOMPurify (allowlisted tags/attributes and safe URL schemes) instead of regex filtering.

### 📚 Documentation

- TipTap chosen over React Email / Unlayer for admin WYSIWYG: exports standalone inline HTML without external assets; React Email remains code-first JSX.

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
