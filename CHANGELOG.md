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
- **Users:** searchable, paginated directory with avatars, groups, owner and active flags, username, and last seen; **user detail** with profile fields, editable **group membership**, stored **ShellUI preferences**, and lazy-loaded per-user **login history**
- **Groups:** create, rename, and delete company groups
- **OAuth apps:** **company-owner** management of social login providers with create, update, and delete flows, **callback URL** helper with copy, **Microsoft tenant** support, and unsaved-change confirmation through shell **dialogs**
- **Login events:** filterable **audit log** by outcome, provider, location, timezone, staff flag, and language, plus paginated **event detail** with related events for the same user
- **Access tokens:** create **personal access tokens** with optional **read-only** scope, staff-only **global metrics** access, one-time token reveal, and revoke
- **API docs:** embedded **Swagger** and **ReDoc** views of the auth backend OpenAPI docs in **developer mode**
- **Developer mode:** **Swagger** and **ReDoc** nav entries and routes appear only when shell **developer features** are enabled
