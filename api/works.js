const SUPABASE_URL = cleanSupabaseUrl(process.env.SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const table = "works";

function cleanSupabaseUrl(value = "") {
  return value
    .trim()
    .replace(/\/rest\/v1\/?$/i, "")
    .replace(/\/+$/, "");
}

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.end(JSON.stringify(payload));
}

function assertConfig() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function normalizeWork(input, existing = {}) {
  const now = new Date().toISOString();
  const date = input.date || existing.date || new Date().toISOString().slice(0, 10);
  const tags = Array.isArray(input.tags)
    ? input.tags
    : String(input.tags || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

  return {
    title: String(input.title || existing.title || "Untitled work").trim(),
    date,
    year: Number(String(date).slice(0, 4)),
    category: String(input.category || existing.category || "Uncategorized").trim(),
    description: String(input.description || existing.description || "").trim(),
    tags,
    imageUrl: String(input.imageUrl || existing.imageUrl || "").trim(),
    link: String(input.link || existing.link || "").trim(),
    featured: Boolean(input.featured ?? existing.featured ?? false),
    presentationNote: String(input.presentationNote || existing.presentationNote || "").trim(),
    accentColor: String(input.accentColor || existing.accentColor || "#24cfe7").trim(),
    updatedAt: now,
  };
}

async function supabase(path, init = {}) {
  assertConfig();
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  let response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...(init.headers || {}),
      },
    });
  } catch (error) {
    const cause = error.cause ? ` Cause: ${error.cause.code || ""} ${error.cause.message || ""}` : "";
    throw new Error(`Supabase fetch failed for ${SUPABASE_URL}. Check SUPABASE_URL and Vercel Production env vars. ${error.message}.${cause}`);
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Supabase request failed: ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function getExisting(id) {
  const rows = await supabase(`${table}?id=eq.${encodeURIComponent(id)}&select=*`);
  return rows[0] || null;
}

export default async function handler(request, response) {
  try {
    if (request.method === "OPTIONS") {
      sendJson(response, 204, {});
      return;
    }

    const pathname = request.url.split("?")[0];
    const parts = pathname.split("/").filter(Boolean);
    const id = parts[0] === "works" && parts[1] ? decodeURIComponent(parts[1]) : "";

    if (request.method === "GET" && !id) {
      const rows = await supabase(`${table}?select=*&order=date.asc`);
      sendJson(response, 200, rows);
      return;
    }

    if (request.method === "POST" && !id) {
      const body = await readBody(request);
      const payload = {
        id: body.id || `work-${Date.now()}`,
        ...normalizeWork(body),
        createdAt: body.createdAt || new Date().toISOString(),
      };
      const rows = await supabase(table, { method: "POST", body: JSON.stringify(payload) });
      sendJson(response, 201, rows[0]);
      return;
    }

    if (request.method === "PUT" && id) {
      const existing = await getExisting(id);
      if (!existing) {
        sendJson(response, 404, { error: "Work not found" });
        return;
      }
      const body = await readBody(request);
      const rows = await supabase(`${table}?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(normalizeWork(body, existing)),
      });
      sendJson(response, 200, rows[0]);
      return;
    }

    if (request.method === "DELETE" && id) {
      await supabase(`${table}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
      sendJson(response, 200, { ok: true });
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    sendJson(response, 500, { error: error.message || "Internal server error" });
  }
}
