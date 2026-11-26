import { shortScope } from "./core.js";

const SCOPE_STYLES = ["auto", "word", "short", "icons", "off"];
const PANEL_STYLES = ["auto", "table", "cards", "minimal"];
const DEFAULT_ICONS = { user: "◎", project: "▣", plugin: "⬡", unknown: "?" };
const PRESETS = {
  default: {},
  theme: {},
  mono: { footer: "#b0b0b0", sidebar: "#b0b0b0", selected: "#ffffff" },
  vivid: { footer: "#ffcc00", sidebar: "#8be9fd", selected: "#50fa7b" },
};
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const TOKEN_PATH = /^(?:text|background|border|syntax|markdown|hue)(?:\.[A-Za-z0-9_-]+)+$/;

function stringMap(value) {
  const out = {};
  if (!value || typeof value !== "object") return out;
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string" && item.trim()) out[key] = item.trim();
  }
  return out;
}

/** Normalize the `options` object from the plugin entry in cli.json. */
export function readConfig(options) {
  const raw = options && typeof options === "object" ? options : {};
  const rawColors = raw.colors && typeof raw.colors === "object" ? raw.colors : {};
  const preset = Object.hasOwn(PRESETS, rawColors.preset) ? rawColors.preset : "theme";
  const colors = { ...PRESETS[preset] };
  for (const key of ["footer", "sidebar", "selected"]) {
    if (typeof rawColors[key] === "string" && (HEX.test(rawColors[key]) || TOKEN_PATH.test(rawColors[key]))) {
      colors[key] = rawColors[key];
    }
  }
  return {
    scopeStyle: SCOPE_STYLES.includes(raw.scopeStyle) ? raw.scopeStyle : "auto",
    icons: { ...DEFAULT_ICONS, ...stringMap(raw.icons) },
    names: stringMap(raw.names),
    panelStyle: PANEL_STYLES.includes(raw.panelStyle) ? raw.panelStyle : "auto",
    colors,
  };
}

/** Resolve a hex color or an active-theme token path; fall back when invalid. */
export function resolveColor(theme, value, fallback) {
  if (typeof value !== "string") return fallback;
  if (HEX.test(value)) return value;
  if (!TOKEN_PATH.test(value)) return fallback;
  const found = value.split(".").reduce((node, key) => (node && typeof node === "object" ? node[key] : undefined), theme);
  return found && typeof found === "object" ? found : fallback;
}

export function displayName(config, skill) {
  return config.names[skill] || skill;
}

export function scopeLabel(config, scope, wide = true) {
  if (config.scopeStyle === "off") return "";
  if (config.scopeStyle === "icons") return config.icons[scope] || config.icons.unknown;
  if (config.scopeStyle === "word") return scope || "?";
  if (config.scopeStyle === "short") return shortScope(scope, false);
  return shortScope(scope, wide);
}
