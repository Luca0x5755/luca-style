// consumer-source.mjs 的型別宣告，讓 TS 測試在 typecheck 下可以匯入。
export type ConsumerPlan = { mode: 'local' | 'registry'; pack: string[]; install: string[] | null; audit: string[] | null };
export function planConsumerSource(args: string[]): ConsumerPlan;
export type ConsumerDeps = {
  npm(args: string[], cwd: string): string;
  copyConsumer(): Promise<void>;
  listTarballs(): Promise<string[]>;
  packageDir(name: string): string;
  temporary: string;
  consumerDir: string;
};
export function installConsumer(plan: ConsumerPlan, deps: ConsumerDeps): Promise<void>;
