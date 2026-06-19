import { spawn } from "node:child_process";

const commands = [
  ["api", "node", ["server/index.js"]],
  ["web", "npm.cmd", ["run", "dev", "--", "--port", "5173"]],
];

let opened = false;

for (const [name, command, args] of commands) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: false,
    env: process.env,
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`${name} exited with code ${code}`);
    }
  });
}

const timer = setInterval(async () => {
  if (opened) return;
  try {
    const response = await fetch("http://127.0.0.1:5173/");
    if (!response.ok) return;
    opened = true;
    clearInterval(timer);
    spawn("cmd.exe", ["/c", "start", "", "http://127.0.0.1:5173/"], {
      detached: true,
      stdio: "ignore",
    }).unref();
    console.log("Opened http://127.0.0.1:5173/");
  } catch {
    // Wait until Vite is ready.
  }
}, 600);
