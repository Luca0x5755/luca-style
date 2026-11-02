// report.mjs 的型別宣告，讓 TS 測試在 typecheck 下可以匯入。
export type TrialRun = { group: string; costUsd: number | null; budgetUsd: number };
export function estimateBaseline(runs: TrialRun[]): { perRunUsd: Record<string, number>; estimateUsd: number; ceilingUsd: number; runs: number };
export type OnboardingRun = { outcome: string; guide: { sha: string; sha256: string }; grade: { pass: boolean; failures: { item: string; detail: string }[] } | null; run: { costUsd: number | null; durationMs: number | null } | null; manual?: { stuckAt?: string; guideChange?: string } };
export const cliThreshold: number;
export function onboardingSummary(runs: OnboardingRun[], version?: string): { version: string; guideSha: string; runs: OnboardingRun[]; failCount: number; cliNeeded: boolean; costUsd: number };
