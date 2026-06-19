import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultWorks } from "./defaultWorks.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "data");
const dataFile = join(dataDir, "works.json");
const port = Number(process.env.API_PORT || 8787);

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function sortWorks(works) {
  return [...works].sort((a, b) => new Date(a.date) - new Date(b.date));
}

async function ensureDataFile() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(dataFile, "utf8");
  } catch {
    await writeFile(dataFile, JSON.stringify(defaultWorks, null, 2), "utf8");
  }
}

async function readWorks() {
  await ensureDataFile();
  const raw = await readFile(dataFile, "utf8");
  return sortWorks(JSON.parse(raw));
}

async function writeWorks(works) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(dataFile, JSON.stringify(sortWorks(works), null, 2), "utf8");
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function normalizeWork(input, existing) {
  const now = new Date().toISOString();
  const date = input.date || existing?.date || new Date().toISOString().slice(0, 10);
  const tags = Array.isArray(input.tags)
    ? input.tags
    : String(input.tags || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

  return {
    id: existing?.id || input.id || `work-${Date.now()}`,
    title: String(input.title || existing?.title || "未命名作品").trim(),
    date,
    year: Number(String(date).slice(0, 4)),
    category: String(input.category || existing?.category || "未分类").trim(),
    description: String(input.description || existing?.description || "").trim(),
    tags,
    imageUrl: String(input.imageUrl || existing?.imageUrl || "").trim(),
    link: String(input.link || existing?.link || "").trim(),
    featured: Boolean(input.featured ?? existing?.featured ?? false),
    presentationNote: String(input.presentationNote || existing?.presentationNote || "").trim(),
    accentColor: String(input.accentColor || existing?.accentColor || "#24cfe7").trim(),
    createdAt: existing?.createdAt || input.createdAt || now,
    updatedAt: now,
  };
}

async function handleWorks(request, response, pathname) {
  const works = await readWorks();
  const id = decodeURIComponent(pathname.split("/")[3] || "");

  if (request.method === "GET" && pathname === "/api/works") {
    sendJson(response, 200, works);
    return;
  }

  if (request.method === "POST" && pathname === "/api/works") {
    const body = await readBody(request);
    const work = normalizeWork(body);
    await writeWorks([...works, work]);
    sendJson(response, 201, work);
    return;
  }

  if (request.method === "PUT" && id) {
    const existing = works.find((work) => work.id === id);
    if (!existing) {
      sendJson(response, 404, { error: "Work not found" });
      return;
    }
    const body = await readBody(request);
    const nextWork = normalizeWork(body, existing);
    await writeWorks(works.map((work) => (work.id === id ? nextWork : work)));
    sendJson(response, 200, nextWork);
    return;
  }

  if (request.method === "DELETE" && id) {
    const nextWorks = works.filter((work) => work.id !== id);
    if (nextWorks.length === works.length) {
      sendJson(response, 404, { error: "Work not found" });
      return;
    }
    await writeWorks(nextWorks);
    sendJson(response, 200, { ok: true });
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (request.method === "OPTIONS") {
      sendJson(response, 204, {});
      return;
    }
    if (url.pathname === "/api/health") {
      sendJson(response, 200, { ok: true });
      return;
    }
    if (url.pathname.startsWith("/api/works")) {
      await handleWorks(request, response, url.pathname);
      return;
    }
    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Internal server error" });
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Nebula API listening at http://127.0.0.1:${port}`);
});
