# Shellui admin

Company owners and staff manage users, groups, sign-in, storage, hosting, and email in Shellui admin at `/admin`. The shell is the host around your application. It embeds Shellui admin and passes the session and service URLs through `@shellui/sdk`.

## What the image contains

nginx in this image serves the static admin build. It stores no secrets and no service URLs.

The image includes:

- **Base**: `nginxinc/nginx-unprivileged:1.31-alpine-slim`
- **Port**: `8080`
- **Entrypoint**: `/docker-entrypoint.sh`, which runs `/docker-entrypoint.d/40-shellui-frame-ancestors.sh` before `nginx`
- **User**: `101` (non-root)

The publish workflow builds `linux/amd64` and `linux/arm64`.

## Run the image

Set `FRAME_ANCESTORS` to each shell origin that may embed the app. Replace the placeholder with your origin. Separate extra origins with a space.

This command publishes port `8080` and sets one origin:

```bash
docker run -p 8080:8080 \
  -e FRAME_ANCESTORS="https://your-shell-origin.example.com" \
  shellui/admin:latest
```

This Compose file starts the same image with the same variable:

```yaml
services:
  admin:
    image: shellui/admin:latest
    ports:
      - '8080:8080'
    environment:
      FRAME_ANCESTORS: 'https://your-shell-origin.example.com'
```

Opening the container URL directly shows the notice **Open this app from Shellui**. Set `backend.adminUrl` to the origin you published, keep `backend.adminPathname` at `/admin`, and open that route in the shell.

## Required environment variables

This image reads only `FRAME_ANCESTORS`. The shell passes `backend.url`, `storage.url`, `hosting.url`, and `email.url` when it embeds the app.

| Variable          | Required          | Description                                                                                                                                                                                 |
| ----------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FRAME_ANCESTORS` | Yes in production | Space-separated origins allowed to embed the app. Each entry is `'self'` or an `http(s)` origin. A bare `*` is refused. When you omit it, the Content Security Policy allows only `'self'`. |

Read the full image configuration in the [Docker image](https://github.com/shellui/admin/blob/develop/docs/development.md#docker-image) section of the development notes.

## Image tags

The publish workflow pushes these tags:

- **`X.Y.Z`**: release version, such as `0.10.0` from tag `v0.10.0`
- **`X.Y`**: major and minor, such as `0.10`
- **`latest`**: the highest stable release

Publishing a pre-release, or a stable tag below the highest, leaves `latest` on the highest stable release.

## Health check

The image health check runs wget against `http://127.0.0.1:8080/health`. It runs every 30s, with a 3s timeout, a 5s start period, and 3 retries. nginx returns `200` and the body `ok`.

## Source, docs, and license

The repository, docs site, changelog, license, and product site:

- [GitHub repository](https://github.com/shellui/admin)
- [Shellui docs](https://docs.shellui.com/)
- [Administration panel](https://docs.shellui.com/features/administration/)
- [Changelog](https://github.com/shellui/admin/blob/develop/CHANGELOG.md)
- [MIT license](https://github.com/shellui/admin/blob/develop/LICENSE)
- [Shellui](https://shellui.com)
