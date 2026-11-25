# SkillSentinel

An OpenCode 2 TUI plugin that shows which skill the agent is using **live**, where the skill comes from, how much context it cost, and a searchable **timeline** for the whole project.

```
Bottom bar (right):  ⠧ find-skills 14s +5.6k
Right sidebar:       Skills:
                     find-skills · user · ~+1.3k +7.2k ×1
```

- **Bottom bar** — spinner, skill name, elapsed seconds, and the estimated token delta since the skill started. In narrow terminals it drops the numbers and shortens the name; text never wraps.
- **Right sidebar** — one line per skill used in the current turn, with:
  - **scope**: `user` (global skills), `project` (`.opencode/skills`), or `plugin`
  - **injected**: estimated tokens from the skill body (`~+1.3k`)
  - **used** (after the turn): estimated tokens added while the skill was active (`+7.2k`)
  - **×N**: how many times it was used in the turn
- **Timeline** — `/sentinel` opens a width-aware table of every activation recorded for the project. `j`/`k` move, `return` opens the originating session, `f` cycles project → session → all, `F` toggles fullscreen, `esc` closes. Narrow panels switch to two-line cards; cells are clipped, never wrapped.

Token numbers are estimates: "injected" is `skill body chars ÷ 4`, and "used" is the change in session token counts between activations/turn end. Neither is provider billing.

## Install

Requires OpenCode 2.x.

```sh
opencode plugin add @kastico/skillsentinel
```

This adds the package to `~/.config/opencode/cli.json`. Reload with `/reload` in OpenCode, then check:

```sh
opencode plugin list
```

To remove it: `opencode plugin remove @kastico/skillsentinel`.

For local development, point the config at a checkout instead:

```jsonc
"plugins": ["/absolute/path/to/skillSentinel"]
```

Use one method at a time — two entries load two instances and duplicate the indicator.

## Timeline CLI

The same records are written as JSONL to `~/.local/share/opencode/skillSentinel/timeline.jsonl` (override with `SKILLSENTINEL_DATA_DIR`).

```sh
npx skillsentinel timeline                       # current project
npx skillsentinel timeline --all --since 7       # everything, last 7 days
npx skillsentinel timeline --project skillSentinel --json
npx skillsentinel timeline --prune 90            # keep 90 days
```

```
SkillSentinel timeline — /home/kastico/Work/skillSentinel
2 activations · 2 skills · ~2.8k injected

TIME  SKILL               SCOPE     INJECTED   USED      SESSION
21:21 omarchy             user      ~+1.8k     +3.2k     Run all skills 5 seconds apart
21:20 report              plugin    ~+960      +1.4k     Report test
```

## How it works

The whole TUI plugin is `tui.tsx`; shared logic and the store are in `src/core.js`, and the CLI is `src/cli.js`.

**Detection** (`ctx.data.on`):
| Event | Effect |
|---|---|
| `session.skill.activated` | adds the skill (uses `data.name`, `data.text`) |
| `session.tool.called` | adds the skill found in the tool input (`{ id }` / `{ name }`) |
| `session.usage.updated` | refreshes the session token/cost snapshot |
| `session.execution.started` | clears the current turn for that session |
| `session.execution.succeeded` / `failed` / `interrupted` | stops the spinner and finalizes the record |

On OpenCode 2 a skill tool call arrives as `{"type":"session.tool.called","data":{"input":{"id":"omarchy"}}}` — without a tool name — so detection reads the input shape. An input containing only `id` and/or `name` is treated as a skill call. State is keyed by `sessionID`, so multiple open tabs do not share a list.

**Scope** comes from the skill's `path` in `ctx.data.location.skill.list()`: paths under the user config or `~/.agents`, `~/.claude`, `~/.codex` skill dirs are `user`; paths under the project are `project`; anything else is `plugin`.

**Rendering** uses `prompt.footer.status`, `sidebar.content`, and `session.panel` slots. Signals do not propagate into these slots across the plugin boundary, so every state change re-registers them; a 250 ms timer re-registers only the footer to animate the spinner. A `disposed` flag stops the timer during teardown.

**Storage** appends one JSON object per skill activation to a JSONL file. Records include project, session, agent, branch, scope, injected tokens, and the estimated used tokens/cost delta.

## Develop

```sh
npm install
npm run check   # syntax/JSX check
npm test        # core unit tests
```

Releases are tagged `v1.1.0` style and published by GitHub Actions on tag push.

## Troubleshooting

- **Several old indicators stacked up after edits.** Those are stale slots from hot-reloaded plugin instances. Quit and reopen OpenCode.
- **A skill produced no indicator.** Detection follows tool events, so a skill loaded only from its description (without the skill tool) emits no event.
- **Plugin does not show in `opencode plugin list`.** Check the entry in `cli.json` and reload.
- **No timeline rows.** The CLI and TUI must share the same data dir; check `SKILLSENTINEL_DATA_DIR` if you set it.

## License

MIT
