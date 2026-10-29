// png-pixel.mjs 的型別宣告，讓 TS 測試在 typecheck 下可以匯入。
export function readPng(source: string | Buffer, path?: string): { width: number; height: number; pixel(x: number, y: number): string; alpha(x: number, y: number): number };
export function expectedBg(mode: 'light' | 'dark'): string;
