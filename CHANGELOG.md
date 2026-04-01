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

## [Unreleased]

### 🚨 Changed

- Single dev entrypoint: `pnpm start` at repo root runs only the Vite app (no `@shellui/cli` shell). Static assets and `CNAME` live under `public/`; production build outputs to `dist/` at repo root
- When the app is not loaded in an iframe, show instructions to set `backend.adminUrl` in the main app’s `shellui.config.ts` instead of the full admin UI
- Flatten repo layout: one `package.json` at the root (no `app/` subfolder or pnpm workspace)

## [0.1.0] - 2026-04-01

### ✨ Feature

- Initial admin app scaffold: ShellUI + Vite + React + TypeScript, `@shellui/sdk` theme and language sync, shadcn-style UI (button, card, separator), dashboard and users placeholder routes, Vitest smoke test
- GitHub Pages workflow and `admin.shellui.com` custom domain via `static/CNAME`
