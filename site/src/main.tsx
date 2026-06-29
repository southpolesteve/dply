import "@cloudflare/kumo/styles/standalone";
import { LinkButton, Surface } from "@cloudflare/kumo";
import { createRoot } from "react-dom/client";
import "./styles.css";

const installCommand = "curl -fsSL https://dply.southpolesteve.com/install.sh | bash";

function App() {
  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">dply</p>
        <h1>No auth. No config. Just deploy.</h1>
        <p className="lede">
          A tiny wrapper around Wrangler for agents that just need to put local files on the
          internet.
        </p>
        <Surface className="command">
          <code>{installCommand}</code>
        </Surface>
        <div className="actions">
          <LinkButton href="#usage" variant="primary">
            Usage
          </LinkButton>
          <LinkButton href="https://github.com/southpolesteve/dply" variant="secondary">
            GitHub
          </LinkButton>
        </div>
      </section>

      <section id="usage" className="examples">
        <div>
          <h2>Usage</h2>
          <p>Run it where the agent wrote the files.</p>
        </div>
        <div className="grid">
          <Surface className="example">
            <code>dply</code>
            <span>Deploy the current directory.</span>
          </Surface>
          <Surface className="example">
            <code>dply index.html</code>
            <span>Deploy one static page.</span>
          </Surface>
          <Surface className="example">
            <code>dply ./my-app</code>
            <span>Deploy a local app folder.</span>
          </Surface>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
