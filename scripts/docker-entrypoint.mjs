import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../apps/web-components/dist/", import.meta.url)).replace(/[\\/]+$/, "");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".svg": "image/svg+xml",
};

const staticServer = createServer((request, response) => {
  const requested = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
  const relative = requested === "/" ? "index.html" : requested.replace(/^\/+/, "");
  const file = normalize(join(root, relative));
  if (file !== root && !file.startsWith(`${root}${sep}`)) {
    response.writeHead(400).end("Bad request");
    return;
  }
  try {
    if (!statSync(file).isFile()) throw new Error("Not a file");
    response.writeHead(200, {
      "content-type": mimeTypes[extname(file)] || "application/octet-stream",
      "cache-control": "no-cache",
    });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

const api = spawn(process.execPath, ["apps/api/dist/main.js"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: process.env.PORT || "3000" },
  stdio: "inherit",
});

let stopping = false;
function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  staticServer.close();
  if (api.exitCode === null) api.kill(signal);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
api.on("exit", (code) => {
  if (!stopping) process.exitCode = code || 1;
  staticServer.close();
});

staticServer.listen(Number(process.env.STATIC_PORT) || 5173, "0.0.0.0");
