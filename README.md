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

The installed command is a tiny Node script. It requires Node.js 20+ and `npx`
because `dply` deliberately runs Wrangler instead of replacing it.

## What It Does

- detects static files, static folders, Vite apps, Next.js apps, and obvious Worker files
- installs dependencies and runs builds when the local project clearly needs it
- shells out to `npx --yes wrangler@latest`
- delegates Next.js projects to `npx --yes vinext@latest deploy`
- uses temporary Cloudflare preview accounts when Wrangler is not authenticated
- verifies the deployed URL
- prints labeled output designed for coding agents

This is intentionally not a general deployment platform. If a project needs a
custom durable production setup, ask the agent to write normal Cloudflare /
Wrangler config for that project.

## Agent Skill

Point an agent at the skill:

```text
https://dply.southpolesteve.com/SKILL.md
```

That is the best default for arbitrary agents: one stable file with the install command,
deployment policy, success reporting, and failure behavior. For agents that support persistent
skills, install the `skills/dply` folder from this repo.

## Development

```bash
bun install
bun run check
bun run lint
bun run build
bun run smoke:dry
```

GitHub Actions runs format check, typecheck, lint, build, and dry-run fixture
smokes for single HTML, static folders, Worker JS, Vite, Vue, Svelte, and
Next.js via Vinext. A separate weekly/manual workflow runs real unauthenticated
temporary deploy smokes with claim tokens redacted from public logs.
