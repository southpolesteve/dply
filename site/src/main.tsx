import "@cloudflare/kumo/styles/standalone";
import { Surface } from "@cloudflare/kumo";
import { createRoot } from "react-dom/client";
import "./styles.css";

const installCommand = "curl -fsSL https://dply.southpolesteve.com/install.sh | bash";
const repoUrl = "https://github.com/southpolesteve/dply";
const skillUrl = "https://dply.southpolesteve.com/SKILL.md";

const examples = [
  {
    command: "dply",
    label: "Deploy the current directory.",
  },
  {
    command: "dply index.html",
    label: "Deploy one HTML file.",
  },
  {
    command: "dply ./public",
    label: "Deploy a static folder.",
  },
  {
    command: "dply ./vite-app",
    label: "Deploy Vite, Vue, Svelte, and similar apps.",
  },
  {
    command: "dply ./next-app",
    label: "Deploy Next.js through Vinext.",
  },
  {
    command: "dply index.js",
    label: "Deploy a Worker-like JS or TS entrypoint.",
  },
];

function App() {
  return (
    <main className="page">
      <header className="hero">
        <h1>
          <span>No auth.</span>
          <span>No config.</span>
          <span>Just deploy.</span>
        </h1>
        <p className="lede">
          A tiny wrapper around Wrangler for agents that need to put local files on the internet.
          Works with static HTML, Vite, Vue, Svelte, Next.js, Workers, and other frameworks that
          build to static assets.
        </p>
      </header>

      <section className="section">
        <h2>Install</h2>
        <Surface className="command">
          <span className="prompt" aria-hidden="true">
            $
          </span>
          <code>{installCommand}</code>
        </Surface>
      </section>

      <section className="section">
        <h2>Examples</h2>
        <div className="exampleList">
          {examples.map((example) => (
            <Surface className="example" key={example.command}>
              <code>{example.command}</code>
              <span>{example.label}</span>
            </Surface>
          ))}
        </div>
      </section>

      <section className="section agentSection">
        <h2>For agents</h2>
        <p>
          Point an agent at the skill URL. For agents that support persistent skills, install the
          <code> skills/dply </code>
          folder from the <a href={repoUrl}>repo</a>.
        </p>
        <Surface className="command">
          <span className="prompt" aria-hidden="true">
            $
          </span>
          <a href="/SKILL.md">
            <code>{skillUrl}</code>
          </a>
        </Surface>
      </section>

      <footer className="footer">
        <a href={repoUrl}>Source on GitHub</a>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
