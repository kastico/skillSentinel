/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui";
import { createSignal } from "solid-js";

/**
 * Skillmancer — a TUI scrying glass for skill usage.
 *
 * Live: shows the skill currently being "cast" with a braille spinner.
 * Scope: keeps the skills used during the run, with timestamps, until the
 * next prompt clears the ledger.
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
    const [state, setState] = createSignal<State>({ used: [], activeAt: 0, live: false });
    const [frame, setFrame] = createSignal(0);
    const skillCalls = new Set<string>();

    const spinner = () => RUNES[frame() % RUNES.length];
    const terminalWidth = (): number => Number((ctx as any).renderer?.width ?? 0) || 80;

    const timer = setInterval(() => setFrame((value) => (value + 1) % RUNES.length), 100);

    const add = (name: string) => {
      const at = Date.now();
      setState((prev) => {
        const used = prev.used.filter((entry) => entry.name !== name);
        used.push({ name, at });
        return { ...prev, used: used.slice(-8) };
      });
    };

    const cast = (name: string) => {
      add(name);
      setState((prev) => ({ ...prev, active: name, activeAt: Date.now(), live: true }));
    };

    const finishCast = () => setState((prev) => ({ ...prev, active: undefined }));

    const stops = [
      ctx.data.on("session.skill.activated", (event: Event) => {
        const name = (event as any)?.data?.name;
        if (typeof name === "string" && name) cast(name);
      }),
      // In V2 the tool name only arrives in `input.started`; `called` carries
      // the input but not the name, so pair them by call id.
      ctx.data.on("session.tool.input.started", (event: Event) => {
        if (event?.data?.name === "skill" && event.data.id) skillCalls.add(event.data.id);
        // Fallback for plugins loaded after the run already began.
        setState((prev) => (prev.live ? prev : { ...prev, live: true }));
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
        if (names.length > 0) finishCast();
      }),
      ctx.data.on("session.tool.failed", (event: Event) => {
        if (event?.data?.id) skillCalls.delete(event.data.id);
        finishCast();
      }),
      ctx.data.on("session.step.started", () => {
        setState((prev) => (prev.live ? prev : { ...prev, live: true }));
      }),
      ctx.data.on("session.execution.started", () => {
        setState({ used: [], activeAt: 0, live: true });
        skillCalls.clear();
      }),
      ctx.data.on("session.execution.succeeded", () => {
        setState((prev) => ({ ...prev, active: undefined, live: false }));
      }),
      ctx.data.on("session.execution.failed", () => {
        setState((prev) => ({ ...prev, active: undefined, live: false }));
      }),
      ctx.data.on("session.execution.interrupted", () => {
        setState((prev) => ({ ...prev, active: undefined, live: false }));
      }),
    ];

    function Status() {
      const current = state();
      const glyph = current.live ? spinner() : "◇";
      const dim = ctx.theme.text.muted;
      const bright = ctx.theme.text.base;

      // Narrow terminals: one skill only, no scope list.
      if (terminalWidth() < 64) {
        const one = current.active ?? current.used.at(-1)?.name;
        return <text fg={current.live ? bright : dim}>{one ? `${glyph} ${one}` : glyph}</text>;
      }

      const recent = current.used
        .slice(-4)
        .map((entry) => `${entry.name} ${clock(entry.at)}`)
        .join(" · ");
      const casting = current.active ? `casting ${current.active} ${glyph}` : "";
      const label = [casting, recent].filter(Boolean).join(" — ") || "idle";
      return <text fg={current.live ? bright : dim}>{`${glyph} Skillmancer: ${label}`}</text>;
    }

    function Panel() {
      const current = state();
      const bright = ctx.theme.text.base;
      const dim = ctx.theme.text.muted;
      const width = terminalWidth();
      const entries = width < 40 ? current.used.slice(-1) : current.used.slice(-8);

      return (
        <box flexDirection="column">
          <text fg={bright}>{`✦ Skillmancer ${current.live ? spinner() : "◇"}`}</text>
          {current.active ? <text fg={bright}>{`  ◈ casting ${current.active}`}</text> : null}
          <text fg={dim}>⌖ Scope</text>
          {entries.length === 0 ? (
            <text fg={dim}>  none yet</text>
          ) : (
            entries.map((entry) => <text fg={bright}>{`  ${entry.name} ${clock(entry.at)}`}</text>)
          )}
        </box>
      );
    }

    const disposeFooter = ctx.ui.slot({ append: "prompt.footer.status", render: () => <Status /> });
    const disposeSidebar = ctx.ui.slot({ append: "sidebar.content", render: () => <Panel /> });

    return () => {
      clearInterval(timer);
      for (const stop of stops) stop?.();
      disposeFooter?.();
      disposeSidebar?.();
    };
  },
});
