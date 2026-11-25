import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

// Rough conversion used only for display. Skill bodies are prose, so ~4 chars/token
// is close enough for an "injected" badge; it is not provider billing.
export const CHARS_PER_TOKEN = 4;

const DATA_ROOT =
  process.env.SKILLSENTINEL_DATA_DIR ||
  process.env.XDG_DATA_HOME ||
  join(homedir(), ".local", "share");

export const LOG_PATH = join(DATA_ROOT, "opencode", "skillSentinel", "timeline.jsonl");

let ready;
function ensureDir() {
  if (!ready) ready = mkdir(dirname(LOG_PATH), { recursive: true });
  return ready;
}

function num(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Tokens that occupy context. Cache reads/writes are already part of `input`. */
export function tokensFromUsage(tokens) {
  if (!tokens || typeof tokens !== "object") return 0;
  return num(tokens.input) + num(tokens.output) + num(tokens.reasoning);
}

export function injectedTokens(text) {
  return typeof text === "string" ? Math.round(text.length / CHARS_PER_TOKEN) : 0;
}

function normalizePath(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  let out = value.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!out.startsWith("/")) out = "/" + out;
  return out;
}

/** Where a skill comes from: user config, the current project, or a plugin. */
export function classifyScope(path, project) {
  const skillPath = normalizePath(path);
  if (!skillPath) return "unknown";

  const config = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  const userRoots = [
    join(config, "opencode", "skills"),
    join(homedir(), ".opencode", "skills"),
    join(homedir(), ".agents", "skills"),
    join(homedir(), ".claude", "skills"),
    join(homedir(), ".codex", "skills"),
    join(config, "opencode", "plugins"),
  ].map(normalizePath);

  if (userRoots.some((root) => skillPath === root || skillPath.startsWith(root + "/"))) return "user";

  const projectPath = normalizePath(project);
  if (projectPath && (skillPath === projectPath || skillPath.startsWith(projectPath + "/"))) return "project";

  return "plugin";
}

export function matchesProject(recordProject, filter) {
  if (!filter) return true;
  const a = normalizePath(recordProject).toLowerCase();
  const b = normalizePath(filter).toLowerCase();
  return a === b || a.includes(b) || b.includes(a);
}

export function formatTokens(value) {
  const n = num(value);
  if (Math.abs(n) < 1000) return String(n);
  return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
}

export function formatDelta(value) {
  const n = num(value);
  if (n === 0) return "±0";
  return `${n > 0 ? "+" : "-"}${formatTokens(Math.abs(n))}`;
}

export function formatTime(timestamp) {
  const date = new Date(num(timestamp));
  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export async function appendRecord(record) {
  await ensureDir();
  await appendFile(LOG_PATH, JSON.stringify(record) + "\n", "utf8");
}

/** Newest first. `since` is a number of days; `project` is a path or substring. */
export async function readRecords({ project, since, limit = 200 } = {}) {
  let text;
  try {
    text = await readFile(LOG_PATH, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") return [];
    throw error;
  }

  const cutoff = since == null ? undefined : Date.now() - num(since) * 86_400_000;
  const rows = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      if (!matchesProject(record.project, project)) continue;
      if (cutoff != null && !(num(record.at) >= cutoff)) continue;
      rows.push(record);
    } catch {
      // Ignore a truncated line from an interrupted append.
    }
  }
  rows.sort((a, b) => num(b.at) - num(a.at));
  return rows.slice(0, limit);
}

/** Rewrite the log keeping only records from the last `days` days. */
export async function prune({ days = 90 } = {}) {
  const cutoff = Date.now() - num(days) * 86_400_000;
  const rows = await readRecords({ limit: Number.MAX_SAFE_INTEGER });
  const kept = rows.filter((record) => num(record.at) >= cutoff).reverse();
  const temp = LOG_PATH + ".tmp";
  await ensureDir();
  await writeFile(temp, kept.map((record) => JSON.stringify(record)).join("\n") + (kept.length ? "\n" : ""), "utf8");
  await rename(temp, LOG_PATH);
  return kept.length;
}
