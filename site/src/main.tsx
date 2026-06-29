import "@cloudflare/kumo/styles/standalone";
import { LinkButton, Surface } from "@cloudflare/kumo";
import { CloudArrowUp, Code, GitBranch, TerminalWindow } from "@phosphor-icons/react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const installCommand = "curl -fsSL https://dply.southpolesteve.com/install.sh | bash";

const supportedTargets = [
  "Vite",
  "Next.js",
  "Vue",
  "Svelte",
  "static HTML",
  "Workers",
  "other build-to-static frameworks",
];

const examples = [
  {
    command: "dply",
    label: "Deploy the current directory.",
    icon: TerminalWindow,
  },
  {
    command: "dply index.html",
    label: "Deploy one static page.",
    icon: Code,
  },
  {
    command: "dply ./my-app",
    label: "Deploy a local app folder.",
    icon: GitBranch,
  },
];

function App() {
  return (
    <main className="page">
      <nav className="topbar" aria-label="Primary">
        <a className="brand" href="/" aria-label="dply home">
          <span className="brandMark" aria-hidden="true">
            dp
          </span>
          <span>dply</span>
        </a>
        <a className="navLink" href="https://github.com/southpolesteve/dply">
          GitHub
        </a>
      </nav>

      <section className="hero">
        <div className="heroCopy">
          <p className="eyebrow">
            <span className="statusDot" aria-hidden="true" />
            Agent deploy primitive
          </p>
          <h1>No auth. No config. Just deploy.</h1>
          <p className="lede">
            A tiny wrapper around Wrangler for agents that need to put local files on the internet.
            Supports Vite, Next.js, Vue, Svelte, and other frameworks that build to static assets.
          </p>
          <Surface className="command">
            <span className="prompt" aria-hidden="true">
              $
            </span>
            <code>{installCommand}</code>
          </Surface>
          <div className="actions">
            <LinkButton href="#usage" variant="primary" icon={CloudArrowUp}>
              Deploy something
            </LinkButton>
            <LinkButton
              href="https://github.com/southpolesteve/dply"
              variant="secondary"
              icon={GitBranch}
            >
              GitHub
            </LinkButton>
          </div>
        </div>

        <Surface className="transcript" aria-label="Example dply deployment transcript">
          <div className="terminalBar">
            <span className="terminalDots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span>dply transcript</span>
          </div>
          <div className="terminalBody">
            <p>
              <span className="shell">$</span>
              <code>dply ./my-app</code>
            </p>
            <p>
              <span className="verb">Detected</span>
              Vite app with a build script.
            </p>
            <p>
              <span className="verb">Selected</span>
              Cloudflare temporary preview.
            </p>
            <p>
              <span className="verb">Deployed</span>
              Live URL ready.
            </p>
            <p>
              <span className="verb success">Verified</span>
              HTTP 200.
            </p>
          </div>
        </Surface>
      </section>

      <section className="support" aria-label="Supported project types">
        <span>Works with</span>
        <ul>
          {supportedTargets.map((target) => (
            <li key={target}>{target}</li>
          ))}
        </ul>
      </section>

      <section id="usage" className="usage">
        <div className="sectionIntro">
          <p className="eyebrow">Usage</p>
          <h2>One command from the project folder.</h2>
          <p>
            Run it where the agent wrote the files. <code>dply</code> explains what it inferred,
            what it ran, and what URL is live.
          </p>
        </div>

        <div className="exampleGrid">
          {examples.map((example) => {
            const Icon = example.icon;

            return (
              <Surface className="example" key={example.command}>
                <Icon className="exampleIcon" size={22} weight="duotone" aria-hidden="true" />
                <code>{example.command}</code>
                <span>{example.label}</span>
              </Surface>
            );
          })}
        </div>
      </section>

      <section className="agentNote" aria-label="Agent output contract">
        <div>
          <p className="eyebrow">For agents</p>
          <h2>Readable logs, not magic.</h2>
        </div>
        <div className="noteText">
          <p>
            Every deploy prints the detected project shape, selected adapter, command logs, live
            URL, claim path for temporary previews, and verification result.
          </p>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
