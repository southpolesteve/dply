#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, stat, writeFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const VERSION = "0.1.3";

type Action = {
  label: string;
  detail: string;
};

type CommandResult = {
  code: number;
  stdout: string;
  stderr: string;
};

type DeployMode = "authenticated Cloudflare account" | "temporary Cloudflare preview account";

type DeployPlan = {
  adapter: string;
  source: string;
  root: string;
  assetsDir?: string;
  workerEntry?: string;
  generatedProject?: string;
  buildLogsDir?: string;
  delegatedDeploy?: DelegatedDeploy;
};

type DelegatedDeploy = {
  command: string;
  args: string[];
  dryRunArgs: string[];
  logName: string;
  failureCode: string;
  toolName: string;
};

type DeployResult = {
  name: string;
  compatibilityDate?: string;
  output: string;
  liveUrl?: string;
  claimUrl?: string;
  verification?: { ok: boolean; status?: number; error?: string };
};

const STATIC_EXTENSIONS = new Set([
  ".html",
  ".css",
  ".js",
  ".mjs",
  ".svg",
  ".txt",
  ".json",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".wasm",
  ".xml",
]);

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }

  if (args.includes("--version") || args.includes("-v")) {
    console.log(VERSION);
    return;
  }

  const dryRun = args.includes("--dry-run");
  const positionals = args.filter((arg) => !arg.startsWith("-"));

  if (positionals.length > 1) {
    printFailure({
      code: "INVALID_ARGUMENTS",
      message: "dply accepts at most one local file or directory.",
      inspected: positionals,
      actions: [{ label: "Rejected", detail: "More than one positional input was provided." }],
      nextSteps: ["Run dply with no argument, one local file, or one local folder."],
    });
    process.exit(1);
  }

  const target = path.resolve(process.cwd(), positionals[0] ?? ".");
  const actions: Action[] = [];

  try {
    const plan = await createPlan(target, actions);
    const authenticated = await wranglerIsAuthenticated(actions);
    const mode: DeployMode = authenticated
      ? "authenticated Cloudflare account"
      : "temporary Cloudflare preview account";

    const deploy = await deployPlan(plan, mode, dryRun, actions);
    printSuccess({ plan, deploy, mode, dryRun, actions });
  } catch (error) {
    if (error instanceof DplyError) {
      printFailure(error.payload);
      process.exit(1);
    }

    printFailure({
      code: "UNEXPECTED_ERROR",
      message: error instanceof Error ? error.message : String(error),
      inspected: [target],
      actions,
      nextSteps: [
        "Report this failure exactly to the user.",
        "If this looks like a dply bug or missing support, detailed GitHub issues are helpful.",
      ],
    });
    process.exit(1);
  }
}

function printHelp() {
  console.log(`dply ${VERSION}

No auth. No config. Just deploy.

Usage:
  dply
  dply index.html
  dply ./site

Flags:
  --dry-run    Build and validate the Wrangler command without uploading.
  --help       Show this help.
  --version    Print the dply version.
`);
}

async function createPlan(target: string, actions: Action[]): Promise<DeployPlan> {
  if (!existsSync(target)) {
    throw new DplyError({
      code: "TARGET_NOT_FOUND",
      message: `Target does not exist: ${target}`,
      inspected: [target],
      actions,
      nextSteps: ["Pass a local file or directory that exists on disk."],
    });
  }

  const info = await stat(target);
  if (info.isFile()) {
    return planFile(target, actions);
  }

  if (info.isDirectory()) {
    return planDirectory(target, actions);
  }

  throw new DplyError({
    code: "UNSUPPORTED_TARGET",
    message: "Target is not a regular file or directory.",
    inspected: [target],
    actions,
    nextSteps: ["Pass a local file or directory."],
  });
}

async function planFile(file: string, actions: Action[]): Promise<DeployPlan> {
  const ext = path.extname(file).toLowerCase();
  const root = path.dirname(file);

  if (ext === ".js" || ext === ".ts" || ext === ".mjs") {
    const source = await readFile(file, "utf8");
    if (looksLikeWorker(source)) {
      const generated = await makeWorkerProject(file);
      actions.push({
        label: "Detected",
        detail: `${path.basename(file)} exports a Worker-like handler.`,
      });
      actions.push({
        label: "Generated",
        detail: `Worker adapter project at ${generated.dir}.`,
      });
      return {
        adapter: "worker",
        source: file,
        root,
        workerEntry: generated.entry,
        generatedProject: generated.dir,
      };
    }
  }

  if (ext === ".html") {
    const generated = await makeStaticProjectFromFile(file, "html");
    actions.push({
      label: "Detected",
      detail: `single-file static page from ${path.basename(file)}.`,
    });
    actions.push({
      label: "Generated",
      detail: `temporary static asset directory at ${generated}.`,
    });
    return {
      adapter: "static assets",
      source: file,
      root,
      assetsDir: generated,
      generatedProject: generated,
    };
  }

  if (STATIC_EXTENSIONS.has(ext)) {
    const generated = await makeStaticProjectFromFile(file, "asset");
    actions.push({
      label: "Detected",
      detail: `single static asset from ${path.basename(file)}.`,
    });
    actions.push({
      label: "Generated",
      detail: `temporary static asset directory with an index page at ${generated}.`,
    });
    return {
      adapter: "static assets",
      source: file,
      root,
      assetsDir: generated,
      generatedProject: generated,
    };
  }

  throw new DplyError({
    code: "UNSUPPORTED_FILE_SHAPE",
    message: `Could not infer how to deploy ${path.basename(file)}.`,
    inspected: [file],
    actions,
    nextSteps: [
      "Pass an HTML file, static asset, static folder, Vite app, or Worker-like JS/TS file.",
      "Report this failure exactly to the user.",
    ],
  });
}

async function planDirectory(dir: string, actions: Action[]): Promise<DeployPlan> {
  const packageJsonPath = path.join(dir, "package.json");

  if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as PackageJson;
    if (looksLikeNext(packageJson, dir)) {
      actions.push({
        label: "Detected",
        detail: "Next.js app from package.json and project files.",
      });
      return planNextApp(dir, packageJson, actions);
    }

    if (looksLikeVite(packageJson)) {
      actions.push({
        label: "Detected",
        detail: "Vite app from package.json.",
      });
      return planPackageApp(dir, packageJson, actions);
    }
  }

  if (hasWranglerConfig(dir)) {
    actions.push({
      label: "Detected",
      detail: "existing Wrangler configuration.",
    });
    return {
      adapter: "existing Wrangler project",
      source: dir,
      root: dir,
    };
  }

  if (existsSync(path.join(dir, "index.html"))) {
    actions.push({
      label: "Detected",
      detail: `static folder with index.html at ${dir}.`,
    });
    return {
      adapter: "static assets",
      source: dir,
      root: dir,
      assetsDir: dir,
    };
  }

  const entries = await readdir(dir).catch(() => []);
  throw new DplyError({
    code: "UNSUPPORTED_PROJECT_SHAPE",
    message: "Could not infer how to deploy this directory.",
    inspected: entries.slice(0, 20),
    actions,
    nextSteps: [
      "Pass an explicit file or directory.",
      "Add an index.html, Vite build script, Wrangler config, or Worker entry before retrying.",
      "Report this failure exactly to the user.",
    ],
  });
}

async function planPackageApp(
  dir: string,
  packageJson: PackageJson,
  actions: Action[],
): Promise<DeployPlan> {
  const { logsDir, packageManager } = await ensurePackageDependencies(dir, actions);

  if (!packageJson.scripts?.build) {
    throw new DplyError({
      code: "BUILD_SCRIPT_NOT_FOUND",
      message: "Vite project does not define a build script.",
      inspected: ["package.json"],
      actions,
      nextSteps: ["Add a package.json build script before retrying."],
    });
  }

  await mkdir(logsDir, { recursive: true });
  await runLoggedCommand(
    packageManager.runCommand,
    [...packageManager.runArgs, "build"],
    dir,
    logsDir,
    actions,
  );

  const distDir = path.join(dir, "dist");
  if (!existsSync(path.join(distDir, "index.html"))) {
    throw new DplyError({
      code: "BUILD_OUTPUT_NOT_FOUND",
      message: "Build completed, but dist/index.html was not found.",
      inspected: ["dist"],
      actions,
      nextSteps: ["Check the build output directory or add a standard Vite dist output."],
    });
  }

  actions.push({
    label: "Selected",
    detail: "dist/ as static asset output because dist/index.html exists.",
  });
  return {
    adapter: "Vite static assets",
    source: dir,
    root: dir,
    assetsDir: distDir,
    buildLogsDir: logsDir,
  };
}

async function planNextApp(
  dir: string,
  _packageJson: PackageJson,
  actions: Action[],
): Promise<DeployPlan> {
  const { logsDir } = await ensurePackageDependencies(dir, actions);

  actions.push({
    label: "Selected",
    detail:
      "Vinext because this is a Next.js app and Vinext is the Vite-based Cloudflare deploy path for Next.js.",
  });

  return {
    adapter: "Next.js via Vinext",
    source: dir,
    root: dir,
    buildLogsDir: logsDir,
    delegatedDeploy: {
      command: "npx",
      args: ["--yes", "vinext@latest", "deploy"],
      dryRunArgs: ["--dry-run"],
      logName: "vinext-deploy",
      failureCode: "VNEXT_DEPLOY_FAILED",
      toolName: "Vinext",
    },
  };
}

async function ensurePackageDependencies(dir: string, actions: Action[]) {
  const logsDir = makeLogsDir(dir);
  const packageManager = detectPackageManager(dir);
  actions.push({
    label: "Selected",
    detail: `${packageManager.name} because ${packageManager.reason}.`,
  });

  if (!existsSync(path.join(dir, "node_modules"))) {
    await mkdir(logsDir, { recursive: true });
    await runLoggedCommand(
      packageManager.installCommand,
      packageManager.installArgs,
      dir,
      logsDir,
      actions,
    );
  } else {
    actions.push({
      label: "Skipped",
      detail: "dependency install because node_modules already exists.",
    });
  }

  return { logsDir, packageManager };
}

async function wranglerIsAuthenticated(actions: Action[]): Promise<boolean> {
  const result = await runCommand(
    "npx",
    ["--yes", "wrangler@latest", "whoami", "--json"],
    process.cwd(),
  );
  if (result.code === 0) {
    actions.push({
      label: "Detected",
      detail:
        "Wrangler authentication is available; deployment will use the existing Cloudflare account.",
    });
    return true;
  }

  actions.push({
    label: "Detected",
    detail:
      "Wrangler authentication is not available; deployment will use temporary account support.",
  });
  return false;
}

async function deployWithWrangler(
  plan: DeployPlan,
  mode: DeployMode,
  dryRun: boolean,
  actions: Action[],
): Promise<DeployResult> {
  const compatibilityDate = new Date().toISOString().slice(0, 10);
  const name = makeWorkerName(plan.source);
  const args = ["--yes", "wrangler@latest", "deploy"];
  let cwd = plan.generatedProject ?? plan.root;

  if (plan.assetsDir && !plan.generatedProject) {
    cwd = await mkdtemp(path.join(tmpdir(), "dply-wrangler-"));
    actions.push({
      label: "Generated",
      detail: `temporary Wrangler working directory at ${cwd} to avoid inheriting unrelated parent config.`,
    });
  }

  if (plan.workerEntry) {
    args.push(plan.workerEntry);
  }

  if (plan.assetsDir) {
    args.push("--assets", plan.assetsDir);
  }

  if (!plan.workerEntry && !plan.assetsDir) {
    // Existing Wrangler project.
  } else {
    args.push("--name", name, "--compatibility-date", compatibilityDate);
  }

  if (mode === "temporary Cloudflare preview account") {
    args.push("--temporary");
  }

  if (dryRun) {
    args.push("--dry-run");
  }

  actions.push({
    label: "Running",
    detail: `npx ${args.join(" ")}`,
  });

  const result = await runCommand("npx", args, cwd);
  const output = `${result.stdout}\n${result.stderr}`;
  if (result.code !== 0) {
    const logPath = await saveFailureLog(plan.root, "wrangler-deploy", output);
    throw new DplyError({
      code: "DEPLOY_FAILED",
      message: `Wrangler deploy failed with exit code ${result.code}.`,
      inspected: [plan.source],
      actions,
      nextSteps: [
        "Report this failure exactly to the user.",
        `Full log: ${logPath}`,
        "If this looks like a dply bug or missing support, detailed GitHub issues are helpful.",
      ],
      relevantOutput: output.trim().split("\n").slice(-20),
    });
  }

  actions.push({
    label: dryRun ? "Checked" : "Deployed",
    detail: dryRun
      ? "Wrangler dry-run completed successfully."
      : "Wrangler deploy completed successfully.",
  });

  const urls = [...output.matchAll(/https:\/\/[^\s]+\.workers\.dev[^\s]*/g)].map((match) =>
    cleanUrl(match[0]),
  );
  const claimUrl = output.match(
    /https:\/\/dash\.cloudflare\.com\/claim-preview\?claimToken=[^\s]+/,
  )?.[0];

  const liveUrl = urls.at(-1);
  let verification: { ok: boolean; status?: number; error?: string } | undefined;
  if (!dryRun && liveUrl) {
    verification = await verifyUrl(liveUrl);
    actions.push({
      label: "Verified",
      detail: verification.ok
        ? `HTTP request to ${liveUrl} returned ${verification.status}.`
        : `HTTP request to ${liveUrl} failed: ${verification.error ?? verification.status}.`,
    });
  }

  return {
    name,
    compatibilityDate,
    output,
    liveUrl,
    claimUrl,
    verification,
  };
}

async function deployPlan(
  plan: DeployPlan,
  mode: DeployMode,
  dryRun: boolean,
  actions: Action[],
): Promise<DeployResult> {
  if (plan.delegatedDeploy) {
    return deployWithDelegatedTool(plan, mode, dryRun, actions);
  }

  return deployWithWrangler(plan, mode, dryRun, actions);
}

async function deployWithDelegatedTool(
  plan: DeployPlan,
  mode: DeployMode,
  dryRun: boolean,
  actions: Action[],
): Promise<DeployResult> {
  const delegated = plan.delegatedDeploy!;
  const args = [...delegated.args];

  if (dryRun) {
    args.push(...delegated.dryRunArgs);
  } else if (mode === "temporary Cloudflare preview account") {
    actions.push({
      label: "Warning",
      detail: `${delegated.toolName} deploy does not currently expose dply's temporary-account flag; dply will delegate and report the exact result.`,
    });
  }

  actions.push({
    label: "Running",
    detail: `${delegated.command} ${args.join(" ")}`,
  });

  const result = await runCommand(delegated.command, args, plan.root);
  const output = `${result.stdout}\n${result.stderr}`;

  if (result.code !== 0) {
    const logPath = await saveFailureLog(plan.root, delegated.logName, output);
    throw new DplyError({
      code: delegated.failureCode,
      message: `${delegated.toolName} deploy failed with exit code ${result.code}.`,
      inspected: [plan.source],
      actions,
      nextSteps: [
        "Report this failure exactly to the user.",
        `Full log: ${logPath}`,
        "If this looks like a dply bug or missing support, detailed GitHub issues are helpful.",
      ],
      relevantOutput: output.trim().split("\n").slice(-20),
    });
  }

  actions.push({
    label: dryRun ? "Checked" : "Deployed",
    detail: dryRun
      ? `${delegated.toolName} dry-run completed successfully.`
      : `${delegated.toolName} deploy completed successfully.`,
  });

  const urls = [...output.matchAll(/https:\/\/[^\s]+\.workers\.dev[^\s]*/g)].map((match) =>
    cleanUrl(match[0]),
  );
  const claimUrl = output.match(
    /https:\/\/dash\.cloudflare\.com\/claim-preview\?claimToken=[^\s]+/,
  )?.[0];
  const liveUrl = urls.at(-1);
  let verification: { ok: boolean; status?: number; error?: string } | undefined;

  if (!dryRun && liveUrl) {
    verification = await verifyUrl(liveUrl);
    actions.push({
      label: "Verified",
      detail: verification.ok
        ? `HTTP request to ${liveUrl} returned ${verification.status}.`
        : `HTTP request to ${liveUrl} failed: ${verification.error ?? verification.status}.`,
    });
  }

  return {
    name: makeWorkerName(plan.source),
    output,
    liveUrl,
    claimUrl,
    verification,
  };
}

function printSuccess(input: {
  plan: DeployPlan;
  deploy: DeployResult;
  mode: DeployMode;
  dryRun: boolean;
  actions: Action[];
}) {
  const { plan, deploy, mode, dryRun, actions } = input;
  console.log(dryRun ? "DRY RUN SUCCEEDED" : "DEPLOYMENT SUCCEEDED");
  console.log("");
  if (deploy.liveUrl) {
    console.log(`Live URL: ${deploy.liveUrl}`);
  }
  if (deploy.claimUrl) {
    console.log(`Claim URL: ${deploy.claimUrl}`);
    console.log("Claim expires: within 60 minutes");
  }
  console.log(`Mode: ${mode}`);
  console.log(`Adapter: ${plan.adapter}`);
  console.log(`Source: ${plan.source}`);
  if (plan.generatedProject) {
    console.log(`Generated project: ${plan.generatedProject}`);
  }
  if (deploy.verification) {
    const status = deploy.verification.status ? `, HTTP ${deploy.verification.status}` : "";
    console.log(`Verification: ${deploy.verification.ok ? "passed" : "failed"}${status}`);
  } else if (dryRun) {
    console.log("Verification: skipped for dry-run");
  }
  console.log("");
  console.log("Decisions and actions:");
  for (const action of actions) {
    console.log(`- ${action.label}: ${action.detail}`);
  }
  console.log("");
  console.log("Next step for agent:");
  if (deploy.liveUrl) {
    console.log("- Report the Live URL to the user.");
  } else if (dryRun) {
    console.log("- Report that the dry-run succeeded.");
  }
  if (deploy.claimUrl) {
    console.log("- Include the Claim URL if the user needs to keep the deployment.");
  }
}

function printFailure(payload: FailurePayload) {
  console.log("DEPLOYMENT FAILED");
  console.log("");
  console.log(`Code: ${payload.code}`);
  console.log(`Message: ${payload.message}`);
  if (payload.inspected.length > 0) {
    console.log(`Inspected: ${payload.inspected.join(", ")}`);
  }
  if (payload.relevantOutput && payload.relevantOutput.length > 0) {
    console.log("");
    console.log("Relevant output:");
    for (const line of payload.relevantOutput) {
      console.log(line);
    }
  }
  console.log("");
  console.log("Decisions and actions:");
  for (const action of payload.actions) {
    console.log(`- ${action.label}: ${action.detail}`);
  }
  console.log("");
  console.log("Next step for agent:");
  for (const step of payload.nextSteps) {
    console.log(`- ${step}`);
  }
}

function looksLikeWorker(source: string): boolean {
  return (
    /export\s+default\s+\{[\s\S]*\bfetch\s*\(/.test(source) ||
    /export\s+(async\s+)?function\s+fetch\s*\(/.test(source) ||
    /export\s+default\s+(async\s+)?function\s*\(/.test(source) ||
    /export\s+default\s+(async\s*)?\([^)]*\)\s*=>/.test(source)
  );
}

async function makeWorkerProject(file: string) {
  const dir = await mkdtemp(path.join(tmpdir(), "dply-worker-"));
  const ext = path.extname(file);
  const sourceName = `source${ext}`;
  await copyFile(file, path.join(dir, sourceName));
  const entry = path.join(dir, "worker.ts");
  await writeFile(
    entry,
    `import handlerOrModule, * as named from "./${sourceName}";\n\nconst defaultValue = handlerOrModule as unknown;\nconst fetchHandler = (named as { fetch?: unknown }).fetch ?? (typeof defaultValue === "function" ? defaultValue : undefined);\n\nexport default typeof defaultValue === "object" && defaultValue !== null && "fetch" in defaultValue\n  ? defaultValue\n  : { fetch: fetchHandler };\n`,
  );
  return { dir, entry };
}

async function makeStaticProjectFromFile(file: string, kind: "html" | "asset") {
  const dir = await mkdtemp(path.join(tmpdir(), "dply-static-"));
  if (kind === "html") {
    await copyFile(file, path.join(dir, "index.html"));
    return dir;
  }

  const basename = path.basename(file);
  await copyFile(file, path.join(dir, basename));
  await writeFile(
    path.join(dir, "index.html"),
    `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(basename)}</title>
  </head>
  <body>
    <h1>${escapeHtml(basename)}</h1>
    <p><a href="./${encodeURIComponent(basename)}">Open file</a></p>
  </body>
</html>
`,
  );
  return dir;
}

function hasWranglerConfig(dir: string) {
  return ["wrangler.toml", "wrangler.json", "wrangler.jsonc"].some((name) =>
    existsSync(path.join(dir, name)),
  );
}

function looksLikeVite(packageJson: PackageJson) {
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  return Boolean(
    allDeps.vite ||
    allDeps["vite-plus"] ||
    packageJson.scripts?.dev?.includes("vite") ||
    packageJson.scripts?.build?.includes("vite"),
  );
}

function looksLikeNext(packageJson: PackageJson, dir: string) {
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };
  return Boolean(
    allDeps.next ||
    packageJson.scripts?.dev?.includes("next") ||
    packageJson.scripts?.build?.includes("next") ||
    existsSync(path.join(dir, "next.config.js")) ||
    existsSync(path.join(dir, "next.config.mjs")) ||
    existsSync(path.join(dir, "next.config.ts")),
  );
}

function detectPackageManager(dir: string) {
  if (existsSync(path.join(dir, "bun.lock")) || existsSync(path.join(dir, "bun.lockb"))) {
    return {
      name: "bun",
      reason: "bun.lock exists",
      installCommand: "bun",
      installArgs: ["install"],
      runCommand: "bun",
      runArgs: ["run"],
    };
  }
  if (existsSync(path.join(dir, "pnpm-lock.yaml"))) {
    return {
      name: "pnpm",
      reason: "pnpm-lock.yaml exists",
      installCommand: "pnpm",
      installArgs: ["install"],
      runCommand: "pnpm",
      runArgs: ["run"],
    };
  }
  if (existsSync(path.join(dir, "yarn.lock"))) {
    return {
      name: "yarn",
      reason: "yarn.lock exists",
      installCommand: "yarn",
      installArgs: ["install"],
      runCommand: "yarn",
      runArgs: [],
    };
  }
  return {
    name: "npm",
    reason: "no lockfile-specific package manager was found",
    installCommand: "npm",
    installArgs: ["install"],
    runCommand: "npm",
    runArgs: ["run"],
  };
}

async function runLoggedCommand(
  command: string,
  args: string[],
  cwd: string,
  logsDir: string,
  actions: Action[],
) {
  const label = [command, ...args].join(" ");
  actions.push({ label: "Running", detail: label });
  const result = await runCommand(command, args, cwd);
  const logPath = path.join(logsDir, `${slugify(label)}.log`);
  await writeFile(logPath, `${result.stdout}\n${result.stderr}`);
  if (result.code !== 0) {
    throw new DplyError({
      code: "BUILD_FAILED",
      message: `${label} failed with exit code ${result.code}.`,
      inspected: [cwd],
      actions,
      nextSteps: [
        "Report this failure exactly to the user.",
        `Full log: ${logPath}`,
        "If this looks like a dply bug or missing support, detailed GitHub issues are helpful.",
      ],
      relevantOutput: `${result.stdout}\n${result.stderr}`.trim().split("\n").slice(-20),
    });
  }
  actions.push({
    label: "Succeeded",
    detail: `${label}. Full log: ${logPath}.`,
  });
}

async function runCommand(command: string, args: string[], cwd: string): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
    child.on("error", (error) => {
      resolve({ code: 1, stdout, stderr: `${stderr}\n${error.message}` });
    });
  });
}

async function verifyUrl(url: string) {
  try {
    const response = await fetch(url, { redirect: "follow" });
    return { ok: response.ok, status: response.status };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function makeLogsDir(root: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(root, ".dply", "logs", stamp);
}

async function saveFailureLog(root: string, name: string, output: string) {
  const logsDir = makeLogsDir(root);
  await mkdir(logsDir, { recursive: true });
  const logPath = path.join(logsDir, `${name}.log`);
  await writeFile(logPath, output);
  return logPath;
}

function makeWorkerName(source: string) {
  const base = slugify(path.basename(source, path.extname(source)) || path.basename(source));
  const hash = createHash("sha1").update(source).digest("hex").slice(0, 8);
  return `dply-${base || "app"}-${hash}`.slice(0, 54);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanUrl(url: string) {
  return url.replace(/[),.;]+$/g, "");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

type PackageJson = {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

type FailurePayload = {
  code: string;
  message: string;
  inspected: string[];
  actions: Action[];
  nextSteps: string[];
  relevantOutput?: string[];
};

class DplyError extends Error {
  payload: FailurePayload;

  constructor(payload: FailurePayload) {
    super(payload.message);
    this.payload = payload;
  }
}

await main();
