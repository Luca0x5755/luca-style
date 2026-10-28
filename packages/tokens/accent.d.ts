// 專案強調色輸入：只有日間主色必填（架構 §3.3）。
export type AccentInput = {
  light: string;
  dark?: string;
  secondary?: string;
  soft?: { light?: string; dark?: string };
};

// 推算時需要的該模式中性色，值來自設計變數。
export type AccentNeutrals = {
  bg: string;
  surface: string;
  'surface-subtle': string;
  text: string;
  muted: string;
  'accent-ink': string;
};

// 推算結果，鍵名即 CSS 變數名（不含 --）。
export type AccentRoles = {
  accent: string;
  'accent-secondary': string;
  'accent-soft': string;
  'accent-hover': string;
  'accent-pressed': string;
  'focus-ring': string;
};

export declare function deriveAccent(input: AccentInput, mode: 'light' | 'dark', neutrals: AccentNeutrals): AccentRoles;
