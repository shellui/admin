# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased] - 2026-09-26

### ✨ Feature

- **Email:** Admin calls email-service with the identity JWT. Default origin `https://email.shellui.com`, or `email.url` in the host `shellui.config` (same discovery as `storage.url` and `hosting.url`). Local Compose is `http://localhost:8003`. The Email section has the template library, provider settings, and statistics. Published versions reopen from `GET /templates/{id}/versions/{number}` with their document. Company SMTP is disabled when `smtp_allowed` is false. Provider saves omit untouched `from_name`, `sending_domain`, `bulk_from_email`, credentials, and webhook secrets. Draft send-test posts the editor copy. Staff choose the recipient. A company owner sends only to the session address. Auth templates show the read-only sign-in host list. Button results on the email pages (save, test send, publish, reset, preview, draft send, event toggles, and statistics refresh) and on Email and webhooks (enable, disable, delete, save, secret rotation, test event, and requeue) appear beside that button. The top of the page is reserved for load failures. The dashboard shows a compact email block (sent, delivered, bounced, failed, complaints, suppressed) for the default 30-day window, with a link to Email. The block is hidden when `email.showInAdmin` is false. An unreachable email-service or a company with no provider shows a quiet empty state and does not affect the other dashboard cards. The Email sidebar group is last, after every other section. Identity, Storage, and Hosting keep **Email and webhooks**. Routes such as `#/hosting/webhooks` stay, and `#/webhooks` still opens identity. Email and webhooks lists webhook and email rules together, ordered by event then created date. API errors use `error_code`.
- **Email template library:** **Templates** is a library of the 40 React Email demo designs (Barebone, Matte, Protocol, Arcane, and Studio sets), with search and a set filter, plus the company's own templates. Built-in designs open read-only with **Duplicate to edit**. Company templates can be created, renamed, edited, duplicated, and deleted. An event email is made from **Email and webhooks**: pick the event, then a design, and the rule gets its own copy, published at once with the suggested subject in the rule language. The copy opens inline on the rule page and never appears in the library. **Start over from another template** replaces the design and keeps the subject and preheader. Deleting the rule deletes its copy.
- **Email template editor:** the editor has **Edit**, **Preview**, and **JSON** modes. Edit is an inline editor built on the React Email editor (`@react-email/editor`, loaded on demand), drawn with the design's own styles. Type `/` to add a heading, subheading, text, list, button, divider, image, two to four columns, or a variable. Select text to make it bold, italic, underlined, or a link, and to align it left, center, right, or justified (also `Mod-Shift-L/E/R/J`). Click a button to set its link. Click an image to set its URL (https or a library asset, no upload), alt text, width, link, and alignment; an image left without a URL is not sent. Variable chips insert at the caret, and `{{ placeholders }}` are highlighted. Documents are stored as editor JSON, layout included. Preview composes the email in the browser with the same packages and node set email-service uses, so it matches the sent HTML, at desktop and mobile widths, with catalog example values in place of variables and the subject and preheader above the email. JSON copies the email as `{ subject, preheader, document }` and applies pasted JSON as soon as it is valid. **Send this draft** sits beside **Publish** and opens a small panel to confirm the recipient (staff can change it). The page title is the template name, with a **Sent for** line showing the event label, its event type, and the lane. The **Template** and **Theme** pickers, color themes, **Reset to suggested**, and the vendored templates (`pnpm sync:email-templates`) are removed.
- **Email languages:** an event email is written once and translated in place. Language tabs sit beside **Edit**, **Preview**, and **JSON**, and the editor opens in the Shellui language. In a translation, the canvas shows the same email: type over a block to translate it. Layout, images, and button links stay shared, so changing them in any language changes them everywhere. Blocks still in the main language are outlined in amber, blocks whose main text changed since are outlined in blue (**Mark as up to date** clears them), and each tab shows what is left. An empty subject or preheader shows the main text it falls back to. **Publish** saves every language at once, and each email sends in the rule or recipient language. Preview and **Send this draft** use the open language.
- **Email themes:** a theme menu in the editor toolbar repaints a library design with any theme from Settings > Appearance, or keeps **Template colors**. Each choice is a small email drawn in its colors (page, card, text, button), like the Appearance theme cards, and works with the arrow keys. The canvas and the preview switch live, to compare. The theme is published with the email and applies to every language. A new event email starts with your current Shellui theme, unless its library template saved one: company templates save their theme, and duplicates and event emails made from them keep it. On a built-in design the select previews, and **Duplicate to edit** keeps the chosen theme.
- **Email broadcasts:** **Broadcasts** in the Email section lets owners and staff write one email from a library design and send it to their company's users. **Content** is the template editor, with language tabs and the `first_name`, `last_name`, `recipient_email`, and `company_name` variables. **Audience** targets members by groups (nested groups included), role, access, join date, and last seen, or picks people from the directory plus pasted addresses. A live summary shows how many people get it, how many per language, and who is left out as unsubscribed or suppressed. Each person gets the email in their own language when it is translated, otherwise in the main language. **Send** shows the sender (the bulk from address, ideally on a subdomain such as `news.`), warns about unpublished changes, and sends after a Shellui confirmation. Companies on Resend send through Resend Broadcasts, one per language; others go one by one on the bulk lane. A sent broadcast shows its delivery counts and refreshes while sending.
- **Email newsletters:** **Newsletters** in the Email section, after Broadcasts, manages lists anyone can join from a website, with or without an account. Each list has a **Subscribers** tab (filter by status, find an exact address, add someone with a confirmation email or as already consented, import and export CSV, remove), a **Sign-up form** tab (the endpoint, a form to paste, the CSP hint, and **Replace key**), a **Confirmation email** tab (the template editor on the list's own confirmation email, with the `confirm_url` button) and **Settings** (description, default language, allowed websites, page after confirming, optional Cloudflare Turnstile). Broadcasts get a third audience mode, **Newsletter subscribers**, which sends to a list's confirmed subscribers, each in the language they signed up in.
- **Email fonts:** the editor canvas loads a design's fonts from email-service, like its images, now that library fonts are no longer on Google Fonts.
- **Invite user:** an **Invite user** button on the Users page, and in Company access when **Invitation only** is selected, opens a Shellui modal asking for the email and the email language. The invitee gets access the first time they sign in. Next to it, a **Pending invitations** button shows the pending count (0 included) and opens a modal listing open invitations, with **Revoke** (blocks their sign-in), and **Invite again** or **Delete** (removed for good, which lifts the block) for revoked ones.
- **Delete user:** the user profile page has a **Delete user** section with a red button. After a Shellui confirmation dialog, the user is removed from this application and the admin returns to the user list. The section is hidden on your own profile and, for company owners who aren't staff, on staff users. If the user is the company's only owner, a toast explains why the delete was refused.
- **Log events:** the page (now `#/events`, old `#/login-events` links redirect) lists every identity event, not only sign-ins: accounts, invitations, groups and group membership, SCIM provisioning, SCIM tokens and sign-ins. Newest first, filterable by event type, user email and date range. Each event has a detail page showing its recorded fields and the user's other events. The user profile's **Login history** card becomes **Activity**, with all events for that user and an **Identity events** link to the filtered log.
- **Data retention warning:** the dashboard and the Log events page show a red alert when events are older than the company's retention plus one day. That means the `purge_expired_data` cron is not running; the alert links to the scheduled jobs documentation. The retention period is shown on the Log events page and can only be changed in Django admin.
- **Storage and hosting log events:** the Storage and Hosting sections get their own **Log events** page (`#/storage/events`, `#/hosting/events`) with the same list, filters and detail pages as identity. Each row shows the email of the user who triggered it, linked to their profile. The user profile's **Activity** card links to that user's storage and hosting events. The dashboard shows one retention alert per service, naming the service; storage and hosting retention is set with `EVENT_LOG_RETENTION_DAYS` on each service.
- **Scheduled jobs (staff only):** the dashboard gets a **Scheduled jobs** section for Django staff, hidden for everyone else. For each identity-service job (`retry_webhooks`, `purge_expired_data`) it shows a health badge (healthy, overdue, failing, disabled), the last run and last success as relative times, the duration, the last processed counts and the recent runs with status, trigger, counts and error. Opening a run lists the webhook delivery attempts and email-service events it produced, with links to this company's deliveries. Badges show whether the built-in scheduler is on, Redis is reachable and beat was seen recently. Load errors appear next to the **Refresh** button. Webhook delivery attempts now show their trigger (first try or automatic retry) and, for staff, the scheduled job run. Needs identity-service 0.7.0.

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
