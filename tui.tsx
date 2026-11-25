/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui";

type Event = { data?: { id?: string; name?: string; input?: unknown } };

const RUNES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// The skill tool sends only { id } or { name } — no tool name on the event.
function skillName(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((key) => key !== "id" && key !== "name")) return undefined;
  const name = value.name ?? value.id;
  return typeof name === "string" && name ? name : undefined;
}

export default Plugin.define({
  id: "skillSentinel",
  setup(ctx) {
    let used: string[] = [];
    let current = "";
    let frame = 0;
    let timer: ReturnType<typeof setInterval> | null = null;
    let offFooter: (() => void) | undefined;
    let offSidebar: (() => void) | undefined;
    let disposed = false;

    // Slots do not observe signals, so redraw by re-registering them.
    function render(): void {
      if (disposed) return;
      offFooter?.();
      offSidebar?.();
      offFooter = ctx.ui.slot({
        append: "prompt.footer.status",
        render: () => <text fg={ctx.theme.text.base}>{current ? `${RUNES[frame % RUNES.length]} ${current}` : ""}</text>,
      });
      offSidebar = ctx.ui.slot({
        append: "sidebar.content",
        render: () => (
          <box flexDirection="column">
            <text fg={ctx.theme.text.base}>Skills:</text>
            {used.map((name) => <text fg={ctx.theme.text.base}>{name}</text>)}
          </box>
        ),
      });
    }

    function update(): void {
      if (current && !timer) {
        timer = setInterval(() => {
          if (disposed) return;
          frame++;
          render();
        }, 250);
      }
      if (!current && timer) {
        clearInterval(timer);
        timer = null;
        frame = 0;
      }
      render();
    }

    function cast(name: string): void {
      if (!used.includes(name)) used.push(name);
      current = name;
      update();
    }

    function idle(): void {
      if (current) {
        current = "";
        update();
      }
    }

    const stops = [
      ctx.data.on("session.skill.activated", (event: Event) => {
        const name = (event as any)?.data?.name;
        if (typeof name === "string" && name) cast(name);
      }),
      ctx.data.on("session.tool.called", (event: Event) => {
        const name = skillName(event.data?.input);
        if (name) cast(name);
      }),
      ctx.data.on("session.execution.started", () => {
        used = [];
        current = "";
        update();
      }),
      ctx.data.on("session.execution.succeeded", idle),
      ctx.data.on("session.execution.failed", idle),
      ctx.data.on("session.execution.interrupted", idle),
    ];

    render();

    return () => {
      disposed = true;
      if (timer) clearInterval(timer);
      for (const stop of stops) stop?.();
      offFooter?.();
      offSidebar?.();
    };
  },
});
