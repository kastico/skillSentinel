#!/usr/bin/env node
import {
  LOG_PATH,
  formatDelta,
  formatTime,
  formatTokens,
  prune,
  readRecords,
} from "./core.js";

const HELP = `SkillSentinel — skill usage timeline

Usage: skillsentinel timeline [options]

Options:
  --project <path|name>  Filter by project (default: current directory)
  --all                  Show every project
  --since <days>         Only the last N days
  --limit <n>            Max rows (default: 200)
  --prune [days]         Drop older records (default: 90 days)
  --json                 Print records as JSON
  -h, --help             Show this help

Log: ${LOG_PATH}
`;

function parse(argv) {
  const options = { limit: 200 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--all") options.all = true;
    else if (arg === "--project") options.project = argv[++i];
    else if (arg === "--since") options.since = Number(argv[++i]);
    else if (arg === "--limit") options.limit = Number(argv[++i]);
    else if (arg === "--prune") {
      const next = argv[i + 1];
      options.prune = next && /^\d+$/.test(next) ? Number(argv[++i]) : 90;
    } else if (arg === "timeline") {
      // Allow the natural `skillsentinel timeline` spelling.
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

function column(value, width) {
  return String(value ?? "").padEnd(width);
}

async function main() {
  let options;
  try {
    options = parse(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error(HELP);
    process.exitCode = 1;
    return;
  }

  if (options.help) {
    console.log(HELP);
    return;
  }

  if (options.prune != null) {
    const kept = await prune({ days: options.prune });
    console.log(`Pruned timeline: ${kept} record${kept === 1 ? "" : "s"} kept (${options.prune} days).`);
    return;
  }

  const project = options.all ? undefined : options.project || process.cwd();
  const rows = await readRecords({ project, since: options.since, limit: options.limit });

  if (options.json) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  if (rows.length === 0) {
    console.log(`No skill activations recorded${project ? ` for ${project}` : ""} yet.`);
    console.log(`Log: ${LOG_PATH}`);
    return;
  }

  const skills = new Set(rows.map((row) => row.skill));
  const injected = rows.reduce((sum, row) => sum + (row.injectedTokens || 0), 0);
  console.log(`SkillSentinel timeline${project ? ` — ${project}` : " — all projects"}`);
  console.log(`${rows.length} activations · ${skills.size} skills · ~${formatTokens(injected)} injected`);
  console.log("");
  console.log(
    column("TIME", 6) +
      column("SKILL", 20) +
      column("SCOPE", 10) +
      column("INJECTED", 11) +
      column("USED", 10) +
      "SESSION",
  );
  for (const row of rows) {
    const label = row.sessionTitle || row.sessionID;
    console.log(
      column(formatTime(row.at), 6) +
        column(row.skill, 20) +
        column(row.scope || "unknown", 10) +
        column(`~+${formatTokens(row.injectedTokens)}`, 11) +
        column(row.usedTokensEstimate == null ? "-" : formatDelta(row.usedTokensEstimate), 10) +
        label,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
