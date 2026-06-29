# dply

Use this skill when a user asks you to deploy a local web page, static site,
Vite app, or small Worker preview and no existing deployment workflow is
specified.

## Install

If `dply` is not available, install it:

```bash
curl -fsSL https://dply.southpolesteve.com/install.sh | bash
```

If the installer says the binary directory is not on `PATH`, run `dply` by the
absolute path printed by the installer.

## Use

Run one of:

```bash
dply
dply index.html
dply ./site
```

Read the output carefully. It is written for agents and includes the detected
project shape, commands run, deploy mode, live URL, verification result, and
next step.

On success, report the Live URL. Include the Claim URL if present and if the
user may want to keep the temporary deployment.

On failure, stop and report the failure exactly. Do not file GitHub issues or
perform broad repair loops automatically.
