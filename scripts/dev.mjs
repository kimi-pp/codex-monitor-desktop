import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const bin = (name) => (isWindows ? `${name}.cmd` : name);
const rendererUrl = "http://127.0.0.1:5173";

const children = new Set();

function run(command, args, env = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      ...env
    }
  });
  children.add(child);
  child.on("exit", () => children.delete(child));
  return child;
}

async function waitForRenderer() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30_000) {
    try {
      const response = await fetch(rendererUrl);
      if (response.ok) {
        return;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  throw new Error(`Renderer did not start at ${rendererUrl}`);
}

function shutdown(code = 0) {
  for (const child of children) {
    child.kill();
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const vite = run(bin("vite"), ["--host", "127.0.0.1"]);

try {
  await waitForRenderer();
  const electron = run(bin("electron"), ["."], {
    VITE_DEV_SERVER_URL: rendererUrl
  });
  electron.on("exit", (code) => {
    vite.kill();
    process.exit(code ?? 0);
  });
} catch (error) {
  console.error(error);
  shutdown(1);
}
