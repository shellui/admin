# Security review: admin 0.5.0

Date: 2026-10-07. Scope: everything `develop` ships versus `main` (email service UI, scheduled jobs, SCIM, invitations, delete user, log events, webhooks, OAuth apps wizard, and the dependency bumps folded in from `main`, including `@shellui/sdk` 0.6.0).

Reviewed the admin source, GitHub Pages deploy workflow, and `pnpm audit --prod --audit-level high`. CodeQL runs in CI on this pull request; this document does not replace that job.

## Summary

| Severity | Count | Status                    |
| -------- | ----- | ------------------------- |
| Critical | 0     | none found                |
| High     | 0     | none found                |
| Medium   | 1     | fixed on `develop`        |
| Low      | 6     | left as-is, reasons below |

## Medium (fixed)

### Staff and superuser flags must not be writable from Admin

Shellui policy is that `is_staff` and `is_superuser` are Django admin only. identity-service 0.7.0 returns `400 admin_only_field` if `PUT /api/v1/users/<id>` includes either field. The admin UI already only sends `group_ids` or `is_active`, but `AdminUserUpdatePayload` used to allow `is_staff`, so a future caller could send it.

Fix: `updateAdminUser` strips `is_staff` and `is_superuser` before `JSON.stringify`, and the type no longer lists `is_staff`. Covered by `src/lib/adminUsersApi.spec.ts` (`never sends is_staff or is_superuser`).

The scheduled jobs panel still hides itself unless `useShelluiIsStaff()` is true, and it returns null on HTTP 403. That gate is client-side; the identity API is what enforces staff access.

## Low (left as-is)

1. **GitHub Pages has no response CSP or frame headers.** `.github/workflows/deploy.yml` uploads `dist` with `actions/deploy-pages` and sets no custom headers. A `<meta>` CSP cannot set `frame-ancestors`. Admin must stay frameable by the Shellui shell, so `X-Frame-Options: DENY` would break the product. Leave the deploy as it is.

2. **Newsletter form snippet does not HTML-escape the subscribe URL or Turnstile site key.** `newsletterFormSnippet` interpolates those strings into a `<textarea>` the operator copies onto their own site. A quote in a site key could break out of the attribute in the pasted page (self-XSS of content the operator already saved). The admin page does not render the snippet as HTML.

3. **OAuth icons use `dangerouslySetInnerHTML`.** Markup comes only from repo-bundled SVGs (`hasBundledOAuthIcon` / `loadOAuthIconSvg`), not from a remote URL or the catalog API. A malicious SVG in the repo would be a supply-chain issue, not a runtime injection.

4. **Email `<style>` in the React Email serializer uses `dangerouslySetInnerHTML`.** The live editor inserts head CSS as a React text child (`<style>{scopedHead}</style>`), which escapes it. The serializer path is the HTML that preview puts in an iframe with `sandbox=""`. An empty sandbox blocks scripts, forms, and top navigation, so a `</style>` breakout in the preview cannot run script in the admin origin.

5. **JWT staff checks do not verify the signature.** `getIsStaffFromJwt` reads `user_metadata.is_staff` from the token the shell already handed the iframe. Hiding a nav item is not an authorization boundary. APIs reject non-staff calls.

6. **`resolveAdminAppUrl` accepts any `http:` or `https:` URL from host config.** That config is delivered by the trusted shell. `javascript:` does not match the http(s) branch. Hash routes are built from `window.location.origin`. `softNavigateIframeHash` only writes a hash when `contentWindow.location.origin` equals the admin origin.

## Checked, no issue

- **Email HTML preview.** `EmailPreviewPane` and `EmailLibraryGrid` set `sandbox=""` and `srcDoc`. No `allow-scripts` and no `allow-same-origin`.
- **Template variables.** `fillSampleData` HTML-escapes substitutions in HTML mode. `validateAuthLaneOverride` rejects a literal URL and template tags on the auth lane, so a magic-link or sign-in URL is not painted into an auth template from the editor.
- **Access tokens.** Held in React state from shell settings. API calls send `Authorization: Bearer`. `localStorage` only stores sidebar collapse. Tokens are not placed in query strings.
- **SCIM.** Create response is the only parser that keeps `token`. List rows are prefix, dates, and revoked state. The secret lives in component state, is shown once, and is not written to storage.
- **Email provider keys.** Saves omit blank credentials. Responses expose `credentialsHint` only.
- **postMessage.** Admin listens through `@shellui/sdk`. SDK 0.6.0 auto-trusts the parent origin and drops messages from other origins (`init` `allowedMessageOrigins`, `configureMessageSecurity`).
- **Event detail.** Values go through `formatValue` and render as text.
- **Removed Action email editor.** The old TipTap and DOMPurify editor is gone. Email editing is React Email. Stale changelog lines for that editor are not in 0.5.0.

## Dependencies

- `pnpm audit --prod --audit-level high`: no known vulnerabilities after the lockfile regenerate (pnpm 10.30.0). `pnpm.overrides` keeps `source-map-js` at 1.2.2 or newer.
- **tailwind-merge 3.7.0** (from `main`) targets Tailwind CSS v4. This app stays on Tailwind CSS 3.4. `cn()` is `twMerge(clsx(...))`. Probed merges that the app uses (padding, text size, background color, display, shadow, arbitrary width) still collapse. The app does not use the v3 class renames that no longer merge (`flex-shrink-0` vs `shrink-0`, `overflow-ellipsis` vs `truncate`). `bg-sidebar` is treated as a background color and loses to a later `bg-*`. **Sébastien should visually check the admin chrome** (sidebar, focus rings, cards) after this lands. Do not upgrade Tailwind to v4 in this release.
- **React 19.3** with `@types/react` 19.3 and `@types/react-dom` 19.3 (bumped from 18 so the peer matches). `useRef(null)` is `RefObject<T | null>`; `usePopoverDismiss` accepts that. react-email 6.9.3 installs against React 19.

## Service versions the UI calls

Requires line in the changelog: identity-service 0.7.0, hosting-service 0.6.1, storage-service 0.5.0, email-service 0.1.0.

Those match the features this UI calls (scheduled jobs and event log on identity 0.7.0, hosting 0.6.x, storage 0.5.0; email admin API on email-service 0.1.0). Two in-app error strings are older floors for the webhooks API only, and they were left unchanged:

- hosting webhooks: "Update hosting-service to v0.5.0 or newer."
- storage webhooks: "Update storage-service to v0.4.0 or newer."

Scheduled jobs and the event log need the versions in the Requires line, not those webhook floors.
