# Changelog

All notable changes to SkillSentinel are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.3.0] - 2026-11-26

### Added

- Colors follow the active OpenCode theme by default. Each role accepts a theme token path (e.g. `text.muted`) or a hex value; invalid values fall back to theme tokens.
- Skill names are highlighted with the theme accent (`hue.accent.400`) while scope, tokens and counts stay muted. Configurable with `colors.name` / `colors.meta`.
- Sidebar shows up to five `○ recent` skills from the same session, alongside `●` skills active in the current turn.
- `/sentinel` now opens a **grouped summary**: one row per skill with uses, estimated used tokens and last seen. `enter` drills into that skill's events, `t` toggles the raw timeline, `backspace` goes back.
- Shipped `config.example.jsonc` — a fully commented config to copy into `cli.json` and uncomment options.
- README documents every feature, the full config surface, and the sample file.

### Changed

- Scope icons are letter badges by default: `U` user, `P` project, `M` model/plugin-provided, `?` unknown; `●` active, `○` recent. Override any glyph in `options.icons`.
- Removed the `ICON` label from the `/sentinel` header.
- `panelStyle: "summary"` is the default; `auto`, `table`, `cards` and `minimal` keep the chronological views.

## [1.2.0] - 2026-11-25

### Added

- Plugin configuration through the object form of the `cli.json` plugin entry: `scopeStyle`, `icons`, `names`, `panelStyle`, `colors`.
- `skillsentinel stats` command: aggregates uses, estimated injected/used tokens and sessions per skill; supports `--json`.
- GitHub Actions workflow: checks on PRs and publishes on version tags.

### Changed

- Normalized the `bin` path for npm publishing.

## [1.1.0] - 2026-11-25

### Added

- Live footer indicator: spinner, skill name, elapsed seconds and estimated token delta.
- Sidebar showing skill scope (`user` / `project` / `plugin`), estimated injected and used tokens, and repeat counts.
- `/sentinel` panel with filters, session navigation and a width-aware chronological table.
- `skillsentinel timeline` CLI over an append-only JSONL log.
- Responsive rendering: clipping instead of wrapping, tiered footer/sidebar, two-line cards in narrow panels.

## [1.0.0] - 2026-11-25

### Added

- Initial TUI plugin: spinner and active skill in the footer, plain skill list in the sidebar.
- Skill detection from `session.tool.called` input and `session.skill.activated`.
