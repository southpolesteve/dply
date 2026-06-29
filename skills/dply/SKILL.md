---
name: dply
description: Deploy local web projects with dply to Cloudflare preview URLs. Use when the user asks to deploy, publish, preview, share, or put online a local web page, static folder, Vite/Vue/Svelte app, Next.js app, Worker-like JS/TS file, or other local web project with minimal setup, especially agent-created projects that need a live URL.
---

# dply

Use `dply` to turn local files on disk into a live Cloudflare preview URL with one command.

## Default Behavior

- Prefer a real deploy by default. Use `--dry-run` only when the user asks not to deploy.
- Use the path the user provided. If no path is provided, deploy the current working directory.
- Treat this as local-disk-only: do not pass remote URLs, git URLs, or prompt text to `dply`.
- Do not run Vercel, Netlify, or other production deploy commands first. Let `dply` infer the safest Cloudflare preview path.

## Install

Check for `dply`:

```bash
command -v dply
```

If it is not available, install it:

```bash
curl -fsSL https://dply.southpolesteve.com/install.sh | bash
```

`dply` requires Node.js 20+ and `npx` because it deliberately shells out to Wrangler. If the
installer prints an absolute path because the install directory is not on `PATH`, run that path.

## Deploy

Run the smallest matching command:

```bash
dply
dply index.html
dply ./site
dply ./my-app
```

Supported common shapes include static HTML, static folders, Vite apps, Vue apps, Svelte apps,
Next.js apps through Vinext, Worker-like JavaScript/TypeScript files, and other frameworks that
build to static assets.

## Read The Output

`dply` output is written for agents. Read it carefully and preserve the important facts:

- Live URL
- Claim URL, when a temporary Cloudflare preview is used
- Claim expiration, when present
- deploy mode
- selected adapter
- source path
- generated or modified files
- command log paths
- verification result
- next steps printed by `dply`

On success, report the Live URL to the user. Include the Claim URL only when reporting privately to
the user, because it may contain a claim token. Mention whether verification passed.

If `dply` says it wrote files, installed dependencies, ran a build, delegated to Vinext, used an
authenticated Cloudflare account, or used a temporary preview account, summarize that plainly.

## Failure Policy

On failure, stop and report the `dply` failure exactly. Include:

- failure code and message
- inspected paths or project shape
- log file paths printed by `dply`
- next steps printed by `dply`

Do not start broad repair loops, file GitHub issues, or switch providers automatically. If the
failure looks like missing `dply` support, mention that detailed bug reports with redacted logs are
helpful.
