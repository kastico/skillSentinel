/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui";

type Event = { data?: { id?: string; name?: string; input?: unknown } };

const RUNES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function skillName(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const value = (input as Record<string, unknown>).name ?? (input as Record<string, unknown>).id;
  return typeof value === "string" && value ? value : undefined;
}

export default Plugin.define({
  id: "skillmancer",
  setup(ctx) {
    let used: string[] = [];
    let current = "";
    let frame = 0;
    let timer: ReturnType<typeof setInterval> | null = null;
    const skillCalls = new Set<string>();
    let offFooter: (() => void) | undefined;
    let offSidebar: (() => void) | undefined;

    // Slots do not observe signals, so redraw by re-registering them.
    function render(): void {
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

    const stops = [
      ctx.data.on("session.skill.activated", (event: Event) => {
        const name = (event as any)?.data?.name;
        if (typeof name === "string" && name) cast(name);
      }),
      // V2 sends the tool name in `input.started` and the input in `called`.
      ctx.data.on("session.tool.input.started", (event: Event) => {
        if (event?.data?.name === "skill" && event.data.id) skillCalls.add(event.data.id);
      }),
      ctx.data.on("session.tool.called", (event: Event) => {
        if (event?.data?.name !== "skill" && !skillCalls.delete(event?.data?.id ?? "")) return;
        const name = skillName(event.data?.input);
        if (name) cast(name);
      }),
      ctx.data.on("session.execution.started", () => {
        used = [];
        current = "";
        skillCalls.clear();
        update();
      }),
    ];

    render();

    return () => {
      if (timer) clearInterval(timer);
      for (const stop of stops) stop?.();
      offFooter?.();
      offSidebar?.();
    };
  },
});
