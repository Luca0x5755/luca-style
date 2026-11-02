// report.mjs 的型別宣告，讓 TS 測試在 typecheck 下可以匯入。
export type TrialRun = { group: string; costUsd: number | null; budgetUsd: number };
export function estimateBaseline(runs: TrialRun[]): { perRunUsd: Record<string, number>; estimateUsd: number; ceilingUsd: number; runs: number };
