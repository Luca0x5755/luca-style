// baseline.mjs 的型別宣告，讓 TS 測試在 typecheck 下可以匯入。
export type BaselineData = {
  series?: string; scene: string; group: string; outcome: string; reason?: string; harnessCause?: string; supersedes?: string;
  guide?: { sha: string; sha256: string };
  run?: { costUsd: number | null; durationMs: number | null } | null;
  grade?: { pass?: boolean; hardcodedColors?: { count: number }; axe?: { serious: number; critical: number } | null; overflow?: Record<number, number> | null; missingStates?: { count: number } } | null;
  isolation?: { ok: boolean };
  rejudgedAt?: string; originalJudgement?: { outcome: string; reason?: string; harnessCause?: string | null };
  usage?: { designMdTouched: number; llmsTxtTouched: number; packageFileReads: number };
};
export type BaselineRecord = { file: string; data: BaselineData };
export const baselineScenes: { scene: string; title: string }[];
export const baselineGroups: { group: string; title: string }[];
export const repeats: number;
export const totalRuns: number;
export const guardUsd: number;
export function baselineGuard(records: { series?: string; guide?: { sha256: string }; run?: { costUsd: number | null } | null }[], guideSha256: string, limitUsd?: number): number;
export function rerunProblem(records: BaselineRecord[], options: { supersedes: string }): string | null;
export function effectiveRuns(records: BaselineRecord[]): BaselineRecord[];
export function median(values: (number | null)[]): number | null;
export function baselineTrespasses(toolUses: { name: string; input?: unknown }[], options: { roots: string[]; workspace: string; group: string }): { tool: string; input: string }[];
export function treatmentUsage(toolUses: { name: string; input?: unknown }[]): { designMdTouched: number; llmsTxtTouched: number; packageFileReads: number; consumerGuideTouched: number };
export function baselineClassify(state: { build?: { ok: boolean; outputTail?: string }; graded?: object | null; timedOut?: boolean; signal?: string | null; exitCode?: number | null; result?: { subtype?: string } | null; parsed?: boolean; isolationProblems?: string[]; harnessError?: Error | null }): { grade: { pass: boolean; failures: { item: string; detail: string }[] } | null; outcome: string; reason: string; harnessCause?: string };
export type BaselineSummary = {
  count: number; complete: boolean; costUsd: number;
  cells: { scene: string; group: string; runs: BaselineRecord[]; passed: number; medians: Record<string, number | null> }[];
  failed: { file: string; scene: string; group: string; outcome: string; reason?: string; harnessCause: string | null; superseded: boolean; supersededBy: string | null }[];
};
export function baselineSummary(records: BaselineRecord[], options?: { allowPartial?: boolean }): BaselineSummary;
export function renderBaseline(records: BaselineRecord[], summary: BaselineSummary): string;
export { classifyOutcome } from './onboarding.mjs';
export function rejudgeIsolation<T extends object>(record: T, toolUses: { name: string; input?: unknown }[], options: { roots: string[]; workspace: string }): T & { outcome: string; reason: string; harnessCause?: string; isolation: { ok: boolean; problems: string[]; trespasses: unknown[] }; originalJudgement: { outcome: string; harnessCause?: string | null } };
export function markHarnessCaused<T extends object>(record: T, reason: string): T & { outcome: string; reason: string; harnessCause: string; originalJudgement: { outcome: string } };
