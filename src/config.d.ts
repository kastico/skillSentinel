export interface Config {
  scopeStyle: "auto" | "word" | "short" | "icons" | "off";
  icons: Record<string, string>;
  names: Record<string, string>;
  panelStyle: "auto" | "table" | "cards" | "minimal";
  colors: { footer?: string; sidebar?: string; selected?: string; name?: string; meta?: string };
}

export declare function readConfig(options: unknown): Config;
export declare function resolveColor(theme: unknown, value: string | undefined, fallback: unknown): unknown;
export declare function displayName(config: Config, skill: string): string;
export declare function scopeLabel(config: Config, scope: string | undefined, wide?: boolean): string;
