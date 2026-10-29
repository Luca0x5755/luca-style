// 主題公開型別；獨立成檔，讓不依賴 React 的首屏腳本也能引用。
export type StyleSuite = 'vibrant' | 'professional';
export type ColorMode = 'system' | 'light' | 'dark';
// 資訊密度與元件外形的具名等級（ADR 0005）；沒給時沿用風格套系的預設等級。
export type Density = 'compact' | 'standard' | 'comfortable';
export type Shape = 'sharp' | 'rounded';
