# dply

No auth. No config. Just deploy.

`dply` is a tiny agent-first wrapper around Wrangler. It turns local files on disk
into a Cloudflare preview URL, while explaining every decision it makes.

```bash
dply
dply index.html
dply ./site
```

## Install

```bash
curl -fsSL https://dply.southpolesteve.com/install.sh | bash
```

## What It Does

- detects static files, static folders, Vite apps, and obvious Worker files
- installs dependencies and runs builds when the local project clearly needs it
- shells out to `npx --yes wrangler@latest`
- uses temporary Cloudflare preview accounts when Wrangler is not authenticated
- verifies the deployed URL
- prints labeled output designed for coding agents

This is intentionally not a general deployment platform. If a project needs a
custom durable production setup, ask the agent to write normal Cloudflare /
Wrangler config for that project.

## Development

```bash
bun install
bun run check
bun run lint
bun run build
bun run smoke:dry
```
