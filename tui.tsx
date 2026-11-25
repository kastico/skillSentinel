/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui";

/**
 * Skillmancer — a TUI scrying glass for skill usage.
 *
 * Live: shows the skill currently being "cast" with a spinning rune.
 * Scope: keeps the skills used during the run, with timestamps, until the
 * next prompt clears the ledger.
 *
 * The slot render functions are re-registered whenever state changes, so the
 * display does not depend on Solid reactivity crossing plugin boundaries.
 */

type Used = { name: string; at: number };
type State = { used: Used[]; active?: string; activeAt: number; live: boolean };

type Event = {
  data?: {
    id?: string;
    name?: string;
    input?: unknown;
    content?: unknown;
  };
};

const RUNES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function clock(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function skillName(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const value = (input as Record<string, unknown>).name ?? (input as Record<string, unknown>).id ?? (input as Record<string, unknown>).skill;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

// Native skill tool: <skill name="...">. Some clients: <skill_content name="...">.
function namesFromText(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(/<skill(?:_content)?\s+name="([^"]+)"/g)) {
    if (match[1]) names.add(match[1]);
  }
  for (const match of text.matchAll(/\/skill:([a-zA-Z0-9_-]+)/g)) {
    if (match[1]) names.add(match[1]);
  }
  return [...names];
}

function namesFromContent(content: unknown): string[] {
  if (typeof content === "string") return namesFromText(content);
  if (!Array.isArray(content)) return [];
  const names = new Set<string>();
  for (const part of content) {
    if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
      for (const name of namesFromText((part as { text: string }).text)) names.add(name);
    }
  }
  return [...names];
}

export default Plugin.define({
  id: "skillmancer",
  setup(ctx) {
    let current: State = { used: [], activeAt: 0, live: false };
    const skillCalls = new Set<string>();
    let frame = 0;
    let spinnerTimer: ReturnType<typeof setInterval> | null = null;
    let disposeFooter: (() => void) | undefined;
    let disposeSidebar: (() => void) | undefined;

    const terminalWidth = (): number => Number((ctx as any).renderer?.width ?? 0) || 80;
    const rune = () => RUNES[frame % RUNES.length];

    function statusText(): string {
      const glyph = current.live ? rune() : "◇";
      if (terminalWidth() < 64) {
        const one = current.active ?? current.used.at(-1)?.name;
        return one ? `${glyph} ${one}` : glyph;
      }
      const recent = current.used
        .slice(-4)
        .map((entry) => `${entry.name} ${clock(entry.at)}`)
        .join(" · ");
      const casting = current.active ? `casting ${current.active} ${glyph}` : "";
      const label = [casting, recent].filter(Boolean).join(" — ") || "idle";
      return `${glyph} Skillmancer: ${label}`;
    }

    function render(): void {
      disposeFooter?.();
      disposeSidebar?.();
      const bright = ctx.theme.text.base;
      const dim = ctx.theme.text.muted;

      disposeFooter = ctx.ui.slot({
        append: "prompt.footer.status",
        render: () => <text fg={current.live ? bright : dim}>{statusText()}</text>,
      });

      const width = terminalWidth();
      const entries = width < 40 ? current.used.slice(-1) : current.used.slice(-8);
      disposeSidebar = ctx.ui.slot({
        append: "sidebar.content",
        render: () => (
          <box flexDirection="column">
            <text fg={bright}>{`✦ Skillmancer ${current.live ? rune() : "◇"}`}</text>
            {current.active ? <text fg={bright}>{`  ◈ casting ${current.active}`}</text> : null}
            <text fg={dim}>⌖ Scope</text>
            {entries.length === 0 ? (
              <text fg={dim}>  none yet</text>
            ) : (
              entries.map((entry) => <text fg={bright}>{`  ${entry.name} ${clock(entry.at)}`}</text>)
            )}
          </box>
        ),
      });
    }

    function startSpinner(): void {
      if (spinnerTimer) return;
      spinnerTimer = setInterval(() => {
        frame = (frame + 1) % RUNES.length;
        render();
      }, 250);
    }

    function stopSpinner(): void {
      if (spinnerTimer) clearInterval(spinnerTimer);
      spinnerTimer = null;
      frame = 0;
    }

    function refresh(): void {
      if (current.live) startSpinner();
      else stopSpinner();
      render();
    }

    function add(name: string): void {
      const at = Date.now();
      const used = current.used.filter((entry) => entry.name !== name);
      used.push({ name, at });
      current = { ...current, used: used.slice(-8) };
    }

    function cast(name: string): void {
      add(name);
      current = { ...current, active: name, activeAt: Date.now(), live: true };
      refresh();
    }

    const stops = [
      ctx.data.on("session.skill.activated", (event: Event) => {
        const name = (event as any)?.data?.name;
        if (typeof name === "string" && name) cast(name);
      }),
      // V2: the tool name arrives in `input.started`, the input in `called`.
      ctx.data.on("session.tool.input.started", (event: Event) => {
        if (event?.data?.name === "skill" && event.data.id) skillCalls.add(event.data.id);
        if (!current.live) {
          current = { ...current, live: true };
          refresh();
        }
      }),
      ctx.data.on("session.tool.called", (event: Event) => {
        const id = event?.data?.id ?? "";
        const matched = skillCalls.delete(id);
        if (event?.data?.name !== "skill" && !matched) return;
        const name = skillName(event.data?.input);
        if (name) cast(name);
      }),
      ctx.data.on("session.tool.success", (event: Event) => {
        const names = namesFromContent(event?.data?.content);
        for (const name of names) add(name);
        if (names.length > 0) {
          current = { ...current, active: undefined };
          refresh();
        }
      }),
      ctx.data.on("session.tool.failed", (event: Event) => {
        if (event?.data?.id) skillCalls.delete(event.data.id);
        if (current.active) {
          current = { ...current, active: undefined };
          refresh();
        }
      }),
      ctx.data.on("session.step.started", () => {
        if (!current.live) {
          current = { ...current, live: true };
          refresh();
        }
      }),
      ctx.data.on("session.execution.started", () => {
        current = { used: [], activeAt: 0, live: true };
        skillCalls.clear();
        refresh();
      }),
      ctx.data.on("session.execution.succeeded", () => {
        current = { ...current, active: undefined, live: false };
        refresh();
      }),
      ctx.data.on("session.execution.failed", () => {
        current = { ...current, active: undefined, live: false };
        refresh();
      }),
      ctx.data.on("session.execution.interrupted", () => {
        current = { ...current, active: undefined, live: false };
        refresh();
      }),
    ];

    render();

    return () => {
      stopSpinner();
      for (const stop of stops) stop?.();
      disposeFooter?.();
      disposeSidebar?.();
    };
  },
});
