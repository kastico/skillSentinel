import assert from "node:assert/strict";
import { test } from "node:test";
import { displayName, readConfig, scopeLabel } from "../src/config.js";

test("defaults keep the existing display", () => {
  const config = readConfig(undefined);
  assert.equal(config.scopeStyle, "auto");
  assert.equal(config.panelStyle, "auto");
  assert.equal(displayName(config, "omarchy"), "omarchy");
  assert.equal(scopeLabel(config, "user", true), "user");
  assert.equal(scopeLabel(config, "user", false), "U");
  assert.equal(config.icons.plugin, "⬡");
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
  assert.equal(scopeLabel(config, "user"), "◎");
  assert.equal(scopeLabel(config, "user", false), "◎");
  assert.equal(config.panelStyle, "cards");
  assert.equal(scopeLabel(readConfig({ scopeStyle: "off" }), "user"), "");
});

test("invalid values fall back, colors validate", () => {
  const config = readConfig({
    scopeStyle: "wat",
    panelStyle: "nope",
    colors: { preset: "vivid", footer: "red", sidebar: "#8be9fd" },
  });
  assert.equal(config.scopeStyle, "auto");
  assert.equal(config.panelStyle, "auto");
  assert.equal(config.colors.footer, "#ffcc00");
  assert.equal(config.colors.sidebar, "#8be9fd");
  assert.equal(config.colors.selected, "#50fa7b");
});
