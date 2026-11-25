/** @jsxImportSource @opentui/solid */
import { Plugin, usePlugin } from "@opencode/plugin/tui";
import { For, Show, createSignal } from "solid-js";
import {
  appendRecord,
  classifyScope,
  fit,
  formatDelta,
  formatTime,
  formatTokens,
  injectedTokens,
  readRecords,
  shortScope,
  tokensFromUsage,
  type SkillActivation,
} from "./src/core.js";

const PANEL_NAME = "skillsentinel.timeline";
const RUNES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

type Event = { created?: number; data?: { sessionID?: string; name?: string; id?: string; text?: string; input?: unknown; tokens?: any; cost?: number } };

type Entry = {
  name: string;
  scope: string;
  injected: number;
  startTokens: number;
  lastUsed: number;
  count: number;
};

type Turn = {
  entries: Entry[];
  currentName: string;
  currentStarted: number;
  currentStartTokens: number;
  currentEntry?: Entry;
  pending?: SkillActivation;
  pendingStartTokens: number;
  pendingStartCost: number;
};

type SkillMeta = { scope: string; path?: string; content?: string };

function newTurn(): Turn {
  return { entries: [], currentName: "", currentStarted: 0, currentStartTokens: 0, pendingStartTokens: 0, pendingStartCost: 0 };
}

// The skill tool sends only { id } or { name } as its input — no tool name on the event.
function skillName(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((key) => key !== "id" && key !== "name")) return undefined;
  const name = value.name ?? value.id;
  return typeof name === "string" && name ? name : undefined;
}

function TimelinePanel(props: { panel: any }) {
  const context = usePlugin();
  const [rows, setRows] = createSignal<SkillActivation[]>([]);
  const [index, setIndex] = createSignal(0);
  const [filter, setFilter] = createSignal<"project" | "session" | "all">("project");
  const width = () => props.panel.width || 80;
  const compact = () => width() < 60;
  const wide = () => width() >= 100;

  const project = String((context as any).location?.project?.canonical ?? (context as any).location?.directory ?? "");
  void readRecords({ limit: 200 }).then(setRows);
  const filtered = () =>
    rows().filter((row) => {
      if (filter() === "all") return true;
      if (filter() === "session") return row.sessionID === props.panel.sessionID;
      return row.project === project || row.project?.includes(project);
    });

  const move = (step: number) => setIndex((current) => Math.min(Math.max(current + step, 0), filtered().length - 1));
  const open = () => {
    const row = filtered()[index()];
    if (row) void context.ui.router.navigate({ type: "session", sessionID: row.sessionID });
  };
  const title = (row: SkillActivation) => row.sessionTitle || row.sessionID.slice(0, 8);

  const tableRow = (row: SkillActivation, selected: boolean) => {
    const withUsed = wide();
    const timeW = 5;
    const skillW = withUsed ? 18 : 12;
    const scopeW = withUsed ? 7 : 1;
    const injW = 6;
    const usedW = 7;
    const fixed = 2 + timeW + 1 + skillW + 1 + scopeW + 1 + injW + (withUsed ? 1 + usedW : 0) + 1;
    const sessionW = Math.max(6, width() - fixed);
    const used = row.usedTokensEstimate == null ? "-" : formatDelta(row.usedTokensEstimate);
    return (
      `${selected ? "›" : " "} ${fit(formatTime(row.at), timeW).padEnd(timeW)} ${fit(row.skill, skillW).padEnd(skillW)} ` +
      `${fit(shortScope(row.scope, withUsed), scopeW).padEnd(scopeW)} ${fit(`~+${formatTokens(row.injectedTokens)}`, injW).padEnd(injW)}` +
      `${withUsed ? ` ${fit(used, usedW).padEnd(usedW)}` : ""} ${fit(title(row), sessionW)}`
    );
  };

  context.keymap.layer(() => ({
    mode: "global",
    priority: 20,
    commands: [
      { id: "skillsentinel.timeline.next", title: "Next skill", bind: "j", enabled: () => props.panel.focused, run: () => move(1) },
      { id: "skillsentinel.timeline.previous", title: "Previous skill", bind: "k", enabled: () => props.panel.focused, run: () => move(-1) },
      { id: "skillsentinel.timeline.open", title: "Open session", bind: "return", enabled: () => props.panel.focused && filtered().length > 0, run: open },
      {
        id: "skillsentinel.timeline.filter",
        title: "Cycle timeline filter",
        bind: "f",
        enabled: () => props.panel.focused,
        run: () => setFilter((current) => (current === "project" ? "session" : current === "session" ? "all" : "project")),
      },
      {
        id: "skillsentinel.timeline.fullscreen",
        title: "Fullscreen timeline",
        bind: "F",
        enabled: () => props.panel.focused,
        run: () => props.panel.toggleFullscreen(),
      },
      { id: "skillsentinel.timeline.close", title: "Close timeline", bind: "escape", enabled: () => props.panel.focused, run: () => props.panel.close() },
    ],
  }));

  const stats = () => {
    const list = filtered();
    const injected = list.reduce((sum, row) => sum + (row.injectedTokens || 0), 0);
    return `${list.length} events · ${new Set(list.map((row) => row.skill)).size} skills · ~${formatTokens(injected)} injected · [${filter()}]`;
  };

  return (
    <box flexDirection="column">
      <text fg={context.theme.text.base} wrapMode="none" truncate>{fit(`SkillSentinel · timeline · ${filter()} · ${filtered().length} events`, width())}</text>
      <Show when={!compact()}>
        <text fg={context.theme.text.base} wrapMode="none" truncate>
          {fit(wide() ? "  TIME  SKILL             SCOPE   INJ     USED    SESSION" : "  TIME  SKILL        S  INJ     SESSION", width())}
        </text>
        <text fg={context.theme.text.base} wrapMode="none" truncate>{"─".repeat(Math.min(width(), 120))}</text>
      </Show>
      <For each={filtered().slice(0, 25)}>
        {(row, rowIndex) =>
          compact() ? (
            <box flexDirection="column">
              <text fg={context.theme.text.base} wrapMode="none" truncate>
                {`${rowIndex() === index() ? "›" : " "} ${fit(formatTime(row.at), 5)} ${fit(row.skill, Math.max(8, width() - 24))} ${shortScope(row.scope, false)} ~+${formatTokens(row.injectedTokens)}`}
              </text>
              <text fg={context.theme.text.base} wrapMode="none" truncate>{`   ${fit(title(row), Math.max(6, width() - 5))}`}</text>
            </box>
          ) : (
            <text fg={context.theme.text.base} wrapMode="none" truncate>{tableRow(row, rowIndex() === index())}</text>
          )
        }
      </For>
      <text fg={context.theme.text.base} wrapMode="none" truncate>{fit(stats(), width())}</text>
      <text fg={context.theme.text.base} wrapMode="none" truncate>
        {fit("j/k move · return open · f filter · F fullscreen · esc close", width())}
      </text>
    </box>
  );
}

export default Plugin.define({
  id: "skillSentinel",
  async setup(ctx) {
    const location = ctx.location ?? ctx.data.location.default();
    const project = String((ctx as any).location?.project?.canonical ?? location?.directory ?? "");

    const turns = new Map<string, Turn>();
    const latestTokens = new Map<string, number>();
    const latestCost = new Map<string, number>();
    const skillMeta = new Map<string, SkillMeta>();
    let currentSession = "";
    let branch: string | undefined;
    let frame = 0;
    let timer: ReturnType<typeof setInterval> | null = null;
    let offFooter: (() => void) | undefined;
    let offSidebar: (() => void) | undefined;
    let offPanel: (() => void) | undefined;
    let disposed = false;

    function live(): boolean {
      return !disposed;
    }

    function sessionInfo(sessionID: string): any {
      try {
        return ctx.data.session.get(sessionID) ?? {};
      } catch {
        return {};
      }
    }

    function snapshot(sessionID: string): number {
      const fromEvent = latestTokens.get(sessionID);
      if (fromEvent !== undefined) return fromEvent;
      return tokensFromUsage(sessionInfo(sessionID).tokens);
    }

    function costSnapshot(sessionID: string): number {
      const fromEvent = latestCost.get(sessionID);
      if (fromEvent !== undefined) return fromEvent;
      const value = Number(sessionInfo(sessionID).cost);
      return Number.isFinite(value) ? value : 0;
    }

    function renderFooter(): void {
      if (!live()) return;
      offFooter?.();
      offFooter = ctx.ui.slot({
        append: "prompt.footer.status",
        render: (props: any) => {
          const sessionID = props?.sessionID || currentSession;
          const turn = sessionID ? turns.get(sessionID) : undefined;
          if (!turn?.currentName) return <text fg={ctx.theme.text.base} wrapMode="none" truncate>{" "}</text>;
          const width = ctx.renderer.terminalWidth || 80;
          const spinner = RUNES[frame % RUNES.length];
          // The status slot is only a slice of the footer row; leave room for host indicators.
          if (width < 80) return <text fg={ctx.theme.text.base} wrapMode="none" truncate>{`${spinner} ${turn.currentName.slice(0, 3)}`}</text>;
          const room = width >= 110 ? 24 : 12;
          const details = props?.showDetails !== false;
          const elapsed = `${Math.max(0, Math.floor((Date.now() - turn.currentStarted) / 1000))}s`;
          const delta = formatDelta(snapshot(sessionID) - turn.currentStartTokens);
          let line = `${spinner} ${turn.currentName}`;
          if (details && line.length + elapsed.length + 1 <= room) line += ` ${elapsed}`;
          if (details && line.length + delta.length + 1 <= room) line += ` ${delta}`;
          return <text fg={ctx.theme.text.base} wrapMode="none" truncate>{fit(line, room)}</text>;
        },
      });
    }

    function renderSidebar(): void {
      if (!live()) return;
      offSidebar?.();
      offSidebar = ctx.ui.slot({
        append: "sidebar.content",
        render: (props: any) => {
          const sessionID = props?.sessionID || currentSession;
          const turn = sessionID ? turns.get(sessionID) : undefined;
          // The slot has no width; the sidebar is roughly 30% of the terminal.
          const width = Math.max(16, Math.floor((ctx.renderer.terminalWidth || 80) * 0.3));
          const wide = width >= 42;
          return (
            <box flexDirection="column">
              <text fg={ctx.theme.text.base} wrapMode="none" truncate>Skills:</text>
              <For each={turn?.entries ?? []}>
                {(entry) => {
                  let line = entry.name;
                  if (wide) line += ` · ${entry.scope} · ~${formatDelta(entry.injected)} ${entry.lastUsed ? formatDelta(entry.lastUsed) : ""} ×${entry.count}`;
                  else if (width >= 28) line += ` ${shortScope(entry.scope, false)} ~${formatDelta(entry.injected)} ×${entry.count}`;
                  else line += ` ×${entry.count}`;
                  return <text fg={ctx.theme.text.base} wrapMode="none" truncate>{fit(line.trim(), width)}</text>;
                }}
              </For>
            </box>
          );
        },
      });
    }

    function renderPanel(): void {
      if (!live()) return;
      offPanel?.();
      offPanel = ctx.ui.slot({
        append: "session.panel",
        render: (panel: any) => (
          <Show when={panel.name === PANEL_NAME}>
            <TimelinePanel panel={panel} />
          </Show>
        ),
      });
    }

    // Slot inputs carry no width; redraw when the terminal changes size.
    const onResize = () => {
      renderFooter();
      renderSidebar();
      renderPanel();
    };
    ctx.renderer.on("resize", onResize);

    function updateTimer(): void {
      const active = [...turns.values()].some((turn) => turn.currentName);
      if (active && !timer) {
        timer = setInterval(() => {
          frame++;
          renderFooter();
        }, 250);
      } else if (!active && timer) {
        clearInterval(timer);
        timer = null;
        frame = 0;
      }
    }

    function finalize(turn: Turn, sessionID: string, tokens: number): void {
      if (!turn.pending) return;
      const used = Math.max(0, tokens - turn.pendingStartTokens);
      turn.pending.usedTokensEstimate = used;
      turn.pending.costDelta = Math.max(0, costSnapshot(sessionID) - turn.pendingStartCost);
      if (turn.currentEntry) turn.currentEntry.lastUsed = used;
      void appendRecord(turn.pending).catch((error) => console.error("[skillSentinel] log failed", error));
      turn.pending = undefined;
    }

    function cast(sessionID: string, rawName: string, at: number, text?: string): void {
      const name = rawName.trim();
      if (!sessionID || !name) return;
      currentSession = sessionID;
      const turn = turns.get(sessionID) ?? newTurn();
      const tokens = snapshot(sessionID);
      finalize(turn, sessionID, tokens);

      const key = name.toLowerCase();
      const meta = skillMeta.get(key);
      const scope = meta?.scope ?? classifyScope(meta?.path, project);
      const injected = injectedTokens(text ?? meta?.content);
      let entry = turn.entries.find((item) => item.name === name);
      if (!entry) {
        entry = { name, scope, injected, startTokens: tokens, lastUsed: 0, count: 0 };
        turn.entries.push(entry);
      }
      entry.count++;
      entry.startTokens = tokens;
      turn.currentEntry = entry;
      turn.currentName = name;
      turn.currentStarted = at || Date.now();
      turn.currentStartTokens = tokens;
      turn.pendingStartTokens = tokens;
      turn.pendingStartCost = costSnapshot(sessionID);
      turn.pending = {
        at: at || Date.now(),
        skill: name,
        sessionID,
        sessionTitle: sessionInfo(sessionID).title,
        project,
        agent: sessionInfo(sessionID).agent,
        scope,
        branch,
        injectedTokens: injected,
      };
      turns.set(sessionID, turn);
      updateTimer();
      renderFooter();
      renderSidebar();
      renderPanel();
    }

    function idle(sessionID: string): void {
      const turn = sessionID ? turns.get(sessionID) : undefined;
      if (!turn) return;
      finalize(turn, sessionID, snapshot(sessionID));
      turn.currentName = "";
      turn.currentEntry = undefined;
      turn.currentStarted = 0;
      updateTimer();
      renderFooter();
      renderSidebar();
      renderPanel();
    }

    function reset(sessionID: string): void {
      if (!sessionID) return;
      currentSession = sessionID;
      const turn = turns.get(sessionID);
      if (turn) finalize(turn, sessionID, snapshot(sessionID));
      turns.set(sessionID, newTurn());
      updateTimer();
      renderFooter();
      renderSidebar();
      renderPanel();
    }

    try {
      await ctx.data.location.skill.sync(location);
      for (const skill of ctx.data.location.skill.list(location) ?? []) {
        const meta: SkillMeta = {
          scope: classifyScope(skill.path, project),
          path: skill.path,
          content: skill.content,
        };
        if (skill.name) skillMeta.set(String(skill.name).toLowerCase(), meta);
        if (skill.id) skillMeta.set(String(skill.id).toLowerCase(), meta);
      }
    } catch (error) {
      console.error("[skillSentinel] skills unavailable", error);
    }

    try {
      await ctx.data.location.vcs.sync(location);
      branch = ctx.data.location.vcs.info(location)?.branch?.current;
    } catch {
      // Not a repository, or VCS data is unavailable.
    }

    ctx.keymap.layer(() => ({
      mode: "global",
      priority: 10,
      commands: [
        {
          id: "skillsentinel.timeline",
          title: "SkillSentinel: skill timeline",
          group: "SkillSentinel",
          palette: true,
          slash: { name: "sentinel", aliases: ["skilltimeline", "skill-sentinel"] },
          enabled: () => true,
          run: () => {
            ctx.ui.panel.open(PANEL_NAME);
            renderPanel();
          },
        },
      ],
      bindings: ["skillsentinel.timeline"],
    }));

    const stops = [
      ctx.data.on("session.skill.activated", (event: Event) => {
        const data = event?.data;
        if (!data) return;
        cast(data.sessionID ?? "", String(data.name ?? data.id ?? ""), event.created ?? 0, data.text);
      }),
      ctx.data.on("session.tool.called", (event: Event) => {
        const data = event?.data;
        const name = skillName(data?.input);
        if (name) cast(data?.sessionID ?? "", name, event.created ?? 0);
      }),
      ctx.data.on("session.usage.updated", (event: Event) => {
        const sessionID = event?.data?.sessionID;
        if (!sessionID) return;
        latestTokens.set(sessionID, tokensFromUsage(event.data?.tokens));
        if (typeof event.data?.cost === "number") latestCost.set(sessionID, event.data.cost);
      }),
      ctx.data.on("session.execution.started", (event: Event) => reset(event?.data?.sessionID ?? "")),
      ctx.data.on("session.execution.succeeded", (event: Event) => idle(event?.data?.sessionID ?? "")),
      ctx.data.on("session.execution.failed", (event: Event) => idle(event?.data?.sessionID ?? "")),
      ctx.data.on("session.execution.interrupted", (event: Event) => idle(event?.data?.sessionID ?? "")),
    ];

    renderFooter();
    renderSidebar();
    renderPanel();

    return () => {
      disposed = true;
      if (timer) clearInterval(timer);
      ctx.renderer.off("resize", onResize);
      for (const stop of stops) stop?.();
      offFooter?.();
      offSidebar?.();
      offPanel?.();
    };
  },
});
