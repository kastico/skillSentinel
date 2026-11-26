import assert from "node:assert/strict";
import { test } from "node:test";
import { displayName, readConfig, resolveColor, scopeLabel } from "../src/config.js";

test("defaults keep the existing display", () => {
  const config = readConfig(undefined);
  assert.equal(config.scopeStyle, "icons");
  assert.equal(config.panelStyle, "summary");
  assert.equal(displayName(config, "omarchy"), "omarchy");
  assert.equal(scopeLabel(config, "user", true), "U");
  assert.equal(scopeLabel(config, "user", false), "U");
  assert.equal(config.icons.plugin, "M");
  assert.equal(config.icons.active, "●");
  assert.equal(config.icons.recent, "○");
});

test("custom names, icons and scope styles", () => {
  const config = readConfig({
    scopeStyle: "icons",
    icons: { plugin: "★" },
    names: { omarchy: "OM" },
    panelStyle: "cards",
  });
  assert.equal(displayName(config, "omarchy"), "OM");
  assert.equal(displayName(config, "report"), "report");
  assert.equal(scopeLabel(config, "plugin"), "★");
  assert.equal(scopeLabel(config, "user"), "U");
  assert.equal(scopeLabel(config, "user", false), "U");
  assert.equal(config.panelStyle, "cards");
  assert.equal(scopeLabel(readConfig({ scopeStyle: "off" }), "user"), "");
});

test("colors follow the active theme unless overridden", () => {
  const theme = {
    text: {
      base: { buffer: [255, 255, 255, 255] },
      muted: { buffer: [167, 167, 167, 255] },
      action: { primary: { focused: { base: { buffer: [0, 255, 0, 255] } } } },
    },
  };
  assert.equal(resolveColor(theme, undefined, theme.text.base), theme.text.base);
  assert.equal(resolveColor(theme, "text.muted", theme.text.base), theme.text.muted);
  assert.equal(resolveColor(theme, "#ff0000", theme.text.base), "#ff0000");
  assert.equal(resolveColor(theme, "nonsense", theme.text.base), theme.text.base);
  assert.equal(readConfig({ colors: { footer: "text.muted" } }).colors.footer, "text.muted");
});

test("invalid values fall back, colors validate", () => {
  const config = readConfig({
    scopeStyle: "wat",
    panelStyle: "nope",
    colors: { preset: "vivid", footer: "red", sidebar: "#8be9fd" },
  });
  assert.equal(config.scopeStyle, "icons");
  assert.equal(config.panelStyle, "summary");
  assert.equal(config.colors.footer, "#ffcc00");
  assert.equal(config.colors.sidebar, "#8be9fd");
  assert.equal(config.colors.selected, "#50fa7b");
});
