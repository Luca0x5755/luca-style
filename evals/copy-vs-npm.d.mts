// copy-vs-npm.mjs 的型別宣告，讓 TS 測試在 typecheck 下可以匯入。
export type CopyVsNpmData = {
  series?: string; scene: string; group: string; outcome: string; reason?: string; harnessCause?: string; supersedes?: string;
  guide?: { sha: string };
  startedAt?: string; claudeVersion?: string;
  run?: { costUsd: number | null; durationMs: number | null } | null;
  grade?: {
    pass?: boolean; hardcodedColors?: { count: number }; axe?: { serious: number; critical: number } | null;
    overflow?: Record<number, number> | null; missingStates?: { count: number };
    update?: { localKept: boolean | null; newVersionInstalled?: boolean; newVersionActive?: boolean; pass?: boolean };
  } | null;
  isolation?: { ok: boolean };
};
export type CopyVsNpmRecord = { file: string; data: CopyVsNpmData };
export type VerdictItem = { item: string; scene: string; rule: 'percent' | 'zero'; npmMedian: number | null; copyMedian: number | null; worse: boolean; improved: boolean; comparable: boolean };
export type Verdict = {
  complete: boolean; copyBetter: boolean | null; conclusion: string; problems: string[]; items: VerdictItem[];
  failed: { file: string; scene: string; group: string; outcome: string; reason: string | null; harnessCause: string | null; superseded: boolean; supersededBy: string | null }[];
  cells: Record<string, { files: string[]; passed: number; medians: Record<string, number | null> }>;
  reuse: { files: string[]; guideSha: string; startedAt: (string | null)[]; claudeVersion: (string | null)[]; note: string };
  costUsd: number;
};
export type UpdateGrade = {
  update: { newVersionInstalled: boolean; newVersionActive: boolean; localKept: boolean; pass: boolean };
  axe: { serious: number; critical: number; items: object[] } | null;
  overflow: Record<number, number>;
};
export const series: string;
export const cells: { scene: string; group: string }[];
export const repeats: number;
export const reusedNpmRuns: string[];
export const reusedGuideSha: string;
export const guardUsd: number;
export const singleRunCapUsd: number;
export const improvementThreshold: number;
export const newVersion: string;
export const newVersionMarker: string;
export function runMetrics(data: CopyVsNpmData): Record<string, number | null>;
export function copyVsNpmVerdict(records: CopyVsNpmRecord[]): Verdict;
export function copyVsNpmGuard(baselineRecords: { run?: { costUsd: number | null } | null }[], seriesRecords: { run?: { costUsd: number | null } | null }[], limitUsd?: number): number;
export function copyGroupProblems(options: { packageJson: string; installedReact: boolean }): string[];
export function applyNewVersion(text: string): string;
export function applyNewVersionDist(text: string): string;
export function applyLocalChange(text: string): string;
export function gradeUpdate(options: { source: string; dist: string; mode: 'npm' | 'copy'; port?: number }): Promise<UpdateGrade>;
export function renderCopyVsNpm(records: CopyVsNpmRecord[], verdict: Verdict): string;
export function adrStatusFor(verdict: { complete: boolean | null; copyBetter: boolean | null }): 'Accepted' | 'Proposed';
