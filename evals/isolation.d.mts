// isolation.mjs 的型別宣告，讓 TS 測試在 typecheck 下可以匯入。
export function initProblems(init: unknown, personalNames: string[]): string[];
export function builtinPlugins(init: unknown): string[];
