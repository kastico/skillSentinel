# SkillSentinel

A tiny OpenCode 2 TUI plugin that shows which skill the agent is using.

```
Bottom bar (right):  ⠹ report
Right sidebar:       Skills:
                     omarchy
                     diagnose-crash
                     find-skills
                     report
```

- **Bottom bar** — a spinner and the name of the skill currently being used. Only one at a time; the newest skill replaces the previous one.
- **Right sidebar** — a plain `Skills:` list of every skill used in the current turn, one name per line, in order of first use. No branding, timestamps, or counts.

The spinner stops when the turn ends (the agent goes idle). The sidebar list stays until you send your next prompt, then both clear.

## Install

Requires OpenCode 2.x. Add the plugin path to `~/.config/opencode/cli.json`:

```json
{
  "plugins": ["/absolute/path/to/skillSentinel"]
}
```

Reload with `/reload` in OpenCode, or restart it. Check that it loaded with:

```sh
opencode plugin list
```

The repo is private; clone it with `git clone git@github.com:kastico/skillSentinel.git` if you have access.

## How it works

The whole plugin is one file, `tui.tsx` (~107 lines).

**Detection.** It subscribes to these bus events:

| Event | Effect |
|---|---|
| `session.skill.activated` | adds the skill name (uses `data.name`) |
| `session.tool.called` | adds the skill name found in the tool input |
| `session.execution.started` | clears both displays for the new prompt |
| `session.execution.succeeded` / `failed` / `interrupted` | stops the spinner |

On OpenCode 2, a skill tool call does **not** include a tool name in the event, and it does not emit `session.skill.activated`. It arrives as:

```json
{"type":"session.tool.called","data":{"id":"chatcmpl-tool-...","input":{"id":"omarchy"}}}
```

So detection reads the tool input instead: an object whose only keys are `id` and/or `name` is treated as a skill, and its string value is the skill name. This avoids matching other tools, whose inputs have keys like `command` or `path`.

**Timing.** A skill tool call completes in ~25 ms. Stopping the spinner on `tool.success` would make it flash for a single frame, so the indicator stays for the whole execution and stops when the turn ends. That is what "being used" means here.

**Rendering.** Two TUI slots are used: `prompt.footer.status` and `sidebar.content`. Solid signals do not propagate across the plugin boundary into these slots, so every state change re-registers both slots (the old ones are disposed first). A 250 ms timer re-registers them to advance the spinner glyph. A `disposed` flag stops the timer and make rendering a no-op after teardown, so a failed cleanup cannot leave a runaway timer spamming errors.

## Files

- `tui.tsx` — plugin source
- `package.json` — package metadata; exports `./tui`

## Troubleshooting

- **Several old indicators stacked up after edits.** Those are stale slots from hot-reloaded plugin instances. Quit and reopen OpenCode once; dead instances cannot be disposed from inside the plugin.
- **A skill produced no indicator.** Detection follows tool events, so following a skill only from its description (without the skill tool) emits no event. It is best-effort, not a guarantee.
- **Plugin does not show in `opencode plugin list`.** Check the path in `cli.json` and reload.

## License

MIT
