// grade.mjs 的型別宣告，讓 TS 測試在 typecheck 下可以匯入。
export type ColorFinding = { file: string; line: number; kind: 'hex' | 'function' | 'named' | 'palette'; text: string };
export type AxeFinding = { id: string; impact: 'serious' | 'critical'; target: string; html: string; state: string; width: number };
export type RunSummary = { costUsd: number | null; durationMs: number | null; turns: number | null; model: string | null; isError: boolean | null };
export type Grade = {
  hardcodedColors: { count: number; items: ColorFinding[] };
  axe: { serious: number; critical: number; items: AxeFinding[] } | null;
  overflow: Record<'1280' | '834' | '390', number> | null;
  missingStates: { count: number; states: string[] };
  pageErrors: string[];
} & RunSummary;
export const states: readonly ['loading', 'empty', 'error', 'success'];
export const widths: readonly [1280, 834, 390];
export function readRun(output: unknown): RunSummary;
export function gradeProject(options: { source: string; dist: string | null; run?: unknown; port?: number }): Promise<Grade>;
