// onboarding.mjs 的型別宣告，讓 TS 測試在 typecheck 下可以匯入。
export function workspaceProblems(files: string[]): string[];
export function findTrespasses(toolUses: { name: string; input?: unknown }[], roots: string[]): { tool: string; input: string }[];
export function classifyOutcome(state: {
  timedOut?: boolean; signal?: string | null; exitCode?: number | null; result?: { type?: string; subtype?: string; is_error?: boolean } | null; parsed?: boolean;
  grade?: { pass: boolean; failures: { item: string; detail: string }[] } | null; isolationProblems?: string[]; harnessError?: Error | null;
}): { outcome: string; reason: string; harnessCause?: string };
export function scrub(text: string, paths: { workspace?: string; temporary?: string; home?: string }): string;
