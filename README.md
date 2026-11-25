# Skillmancer

A small OpenCode TUI plugin: spinner + skill name in the bottom bar, plain skill list in the sidebar.

```
⠹ omarchy          <- footer: skill currently being cast
omarchy            <- sidebar: skills used this turn
find-skills
```

Both clear on the next prompt.

## Install

Requires OpenCode 2.x. Add the path to `~/.config/opencode/cli.json`:

```json
{
  "plugins": ["/absolute/path/to/skillmancer"]
}
```

Reload with `/reload` after changing the plugin list.

## Detection

Listens for `session.skill.activated` and skill tool calls (`session.tool.input.started` + `session.tool.called`). Best-effort: a skill followed only from its description produces no event.

## License

MIT
