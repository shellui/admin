# ShellUI Admin

Administration UI for ShellUI: a React app embedded in the main shell (route `/admin`). This repo is **only the Vite + React app**—no ShellUI shell wrapper.

## Prerequisites

- [pnpm](https://pnpm.io/) (see `packageManager` in `package.json`)

## Development

From this directory, install once and start the dev server:

```bash
pnpm install
pnpm start
```

This runs the app on **http://localhost:5174** (see `vite.config.ts`).

If you open that URL **directly in a browser**, you will see a short message: the admin UI is meant to load **inside an iframe** from the main ShellUI app. Configure the main app’s `shellui.config.ts` with `backend.adminUrl` pointing at this URL, then open **`/admin`** in the shell (as a staff user).

**Run together with the main ShellUI app**

1. Terminal A — main ShellUI repo: `pnpm start` → e.g. `http://localhost:4000`
2. Terminal B — this repo: `pnpm start` → `http://localhost:5174`

In the main app, set:

```ts
backend: {
  // …
  adminPathname: '/admin',
  adminUrl: 'http://localhost:5174',
},
```

## Build & preview

```bash
pnpm build
pnpm preview
# or serve the static folder:
pnpm serve:dist
```

Production deploy (GitHub Pages) outputs the site at the **root** of the domain (for example **https://admin.shellui.com/**). Set the main app’s `adminUrl` to that origin.

## Tests

```bash
pnpm test
```

## Structure

| Path | Role |
|------|------|
| `src/` | Vite + React source |
| `public/` | Static files copied to `dist/` (including `CNAME` for **admin.shellui.com**) |
| `tools/serve/serve.js` | Optional local static server after `pnpm build` |

## License

MIT
