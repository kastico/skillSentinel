export type Scope = "user" | "project" | "plugin" | "unknown";

export interface SkillActivation {
  at: number;
  skill: string;
  sessionID: string;
  sessionTitle?: string;
  project: string;
  agent?: string;
  scope: Scope;
  branch?: string;
  injectedTokens: number;
  usedTokensEstimate?: number;
  costDelta?: number;
}

export interface TokenUsage {
  input?: number;
  output?: number;
  reasoning?: number;
  cache?: { read?: number; write?: number };
}

export declare const CHARS_PER_TOKEN: number;
export declare const LOG_PATH: string;
export declare function tokensFromUsage(tokens: TokenUsage | undefined | null): number;
export declare function injectedTokens(text: string | undefined): number;
export declare function classifyScope(path: string | undefined, project: string | undefined): Scope;
export declare function matchesProject(recordProject: string | undefined, filter: string | undefined): boolean;
export declare function formatTokens(value: number | undefined): string;
export declare function formatDelta(value: number | undefined): string;
export declare function formatTime(timestamp: number | undefined): string;
export declare function fit(value: unknown, width: number): string;
export declare function shortScope(scope: string | undefined, wide?: boolean): string;

export interface SkillSummary {
  skill: string;
  uses: number;
  injected: number;
  used: number;
  sessions: number;
  first: number;
  last: number;
}
export declare function summarize(records: readonly SkillActivation[]): SkillSummary[];
export declare function appendRecord(record: SkillActivation): Promise<void>;
export declare function readRecords(options?: { project?: string; since?: number; limit?: number }): Promise<SkillActivation[]>;
export declare function prune(options?: { days?: number }): Promise<number>;
