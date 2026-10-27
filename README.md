# Shellui Admin

The administration app of Shellui, opened inside the shell at `/admin`.

[![CI](https://github.com/shellui/admin/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/shellui/admin/actions/workflows/ci.yml)
[![Docker Hub](https://img.shields.io/docker/v/shellui/admin?sort=semver&label=docker)](https://hub.docker.com/r/shellui/admin)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Admin is a React app that company owners and staff use to run a Shellui workspace: users, groups, sign-in methods, OAuth apps, SCIM, webhooks and statistics on [identity-service](https://github.com/shellui/identity-service), plus Storage, Hosting and Email sections when the shell config has those services. It never runs on its own. The shell loads it in a frame and passes the session, theme, language and service URLs through the SDK.

Production runs at [admin.shellui.com](https://admin.shellui.com).

## Get started

You need [pnpm](https://pnpm.io/) and a local [Shellui](https://github.com/shellui/shellui) shell with an [identity-service](https://github.com/shellui/identity-service) behind it.

```bash
git clone https://github.com/shellui/admin.git
cd admin
pnpm install
pnpm start   # http://localhost:5174
```

Then point the shell at it in `shellui.config.ts` and open `/admin` as a company owner:

```ts
backend: {
  url: 'http://localhost:8000',
  adminUrl: 'http://localhost:5174',
},
```

Add `storage.url`, `hosting.url` and `email.url` to turn on the matching sections. Opened directly in a browser, the app shows a short notice instead.

## Docker

Each release is published to Docker Hub as `shellui/admin`: a static build on unprivileged nginx, port `8080`, health check on `/health`.

```bash
docker run -p 8080:8080 -e FRAME_ANCESTORS="https://dashboard.shellui.com" shellui/admin:latest
```

`FRAME_ANCESTORS` lists the exact shell origins allowed to embed the app. A bare `*` is refused. The image holds no secrets and no region URLs, so one image works in every region.

## Documentation

- [Administration panel](https://docs.shellui.com/features/administration/) on docs.shellui.com
- [Development notes](docs/development.md): architecture, routes, webhooks, OAuth setup and custom navigation
- [CHANGELOG.md](CHANGELOG.md)

## Development

```bash
pnpm test
pnpm typecheck
pnpm format:check
pnpm build
```

## Contributing

Open an issue or a pull request against `develop`. CI runs the tests, a production build, a secret scan, a dependency audit, a link check and CodeQL. Coding agents start with [AGENTS.md](AGENTS.md).

## Shellui projects

| Project                                                         | What it does                        |
| --------------------------------------------------------------- | ----------------------------------- |
| [shellui](https://github.com/shellui/shellui)                   | The shell, CLI and SDK              |
| [admin](https://github.com/shellui/admin)                       | Administration app inside the shell |
| [files](https://github.com/shellui/files)                       | File explorer for storage-service   |
| [identity-service](https://github.com/shellui/identity-service) | Sign-in, companies and tokens       |
| [storage-service](https://github.com/shellui/storage-service)   | File storage                        |
| [hosting-service](https://github.com/shellui/hosting-service)   | Deploys and serves Shellui apps     |
| [email-service](https://github.com/shellui/email-service)       | Templates and sends email           |
| [skills](https://github.com/shellui/skills)                     | Agent Skills for coding agents      |
| [playground](https://github.com/shellui/playground)             | Live demo of the shell              |

## License

[MIT](LICENSE)
