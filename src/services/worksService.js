import { defaultWorks } from "../data/defaultWorks.js";

const STORAGE_KEY = "nebula-works";
const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function sortWorks(works) {
  return [...works].sort((a, b) => new Date(a.date) - new Date(b.date));
}

function readLocalWorks() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultWorks;
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) && parsed.length ? parsed : defaultWorks;
  } catch {
    return defaultWorks;
  }
}

function writeLocalWorks(works) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sortWorks(works)));
}

async function request(path, options) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${response.status}`);
  }
  return response.json();
}

function normalizeLocalWork(input, existing) {
  const now = new Date().toISOString();
  const date = input.date || existing?.date || new Date().toISOString().slice(0, 10);
  return {
    id: existing?.id || input.id || `work-${Date.now()}`,
    title: input.title?.trim() || existing?.title || "未命名作品",
    date,
    year: Number(date.slice(0, 4)),
    category: input.category?.trim() || existing?.category || "未分类",
    description: input.description?.trim() || existing?.description || "",
    tags: Array.isArray(input.tags) ? input.tags : [],
    imageUrl: input.imageUrl?.trim() || existing?.imageUrl || "",
    link: input.link?.trim() || existing?.link || "",
    featured: Boolean(input.featured ?? existing?.featured ?? false),
    presentationNote: input.presentationNote?.trim() || existing?.presentationNote || "",
    accentColor: input.accentColor?.trim() || existing?.accentColor || "#24cfe7",
    createdAt: existing?.createdAt || input.createdAt || now,
    updatedAt: now,
  };
}

export async function getWorks() {
  try {
    const works = await request("/works");
    writeLocalWorks(works);
    return sortWorks(works);
  } catch {
    return sortWorks(readLocalWorks());
  }
}

export async function createWork(input) {
  try {
    return request("/works", { method: "POST", body: JSON.stringify(input) });
  } catch {
    const works = readLocalWorks();
    const work = normalizeLocalWork(input);
    writeLocalWorks([...works, work]);
    return work;
  }
}

export async function updateWork(id, input) {
  try {
    return request(`/works/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(input) });
  } catch {
    const works = readLocalWorks();
    const existing = works.find((work) => work.id === id);
    const work = normalizeLocalWork(input, existing);
    writeLocalWorks(works.map((item) => (item.id === id ? work : item)));
    return work;
  }
}

export async function deleteWorkById(id) {
  try {
    await request(`/works/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch {
    writeLocalWorks(readLocalWorks().filter((work) => work.id !== id));
  }
}
