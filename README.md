# Skillmancer

An OpenCode TUI plugin — a scrying glass for skill usage.

- **Live:** shows the skill currently being "cast" with a braille spinner.
- **Scope:** keeps the skills used during the run, with timestamps, until the next prompt clears the ledger.
- **Compact:** on a narrow terminal the bottom bar shows only one skill; the full scope stays in the sidebar when there is room.

```
⠹ Skillmancer: casting omarchy — omarchy 01:52:11 · find-skills 01:51:48
```

## Install

Requires OpenCode 2.x.

Add the plugin path to `~/.config/opencode/cli.json`:

```json
{
  "plugins": ["/absolute/path/to/skillmancer"]
}
```

Or install it as a package if published:

```sh
opencode plugin add skillmancer
```

Reload the TUI with `/reload` (or restart it) after changing the plugin list.

## How it detects skills

Plugin id: `skillmancer`. It listens to server events:

- `session.skill.activated` — native skill activation
- `session.tool.input.started` / `session.tool.called` — skill tool calls, matched by call id
- `session.tool.success` — result text containing `<skill name="...">` or `<skill_content name="...">`
- `session.execution.started` — clears the ledger and turns the live glyph on
- `session.execution.succeeded` / `failed` / `interrupted` — turns the live glyph off, keeps the scope

Detection is best-effort: if a skill is followed from its description alone, without the tool being called, there is no event to show.

## License

MIT
