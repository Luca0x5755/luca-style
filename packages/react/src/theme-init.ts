// 首屏腳本與 ThemeProvider 共用的名稱；此檔不可 import React，供首屏腳本在任何環境下產生。
import type { StyleSuite } from './theme-types.js';

// 明暗偏好的瀏覽器儲存鍵；0.1.0 起沿用，使用端的遷移程式依賴此鍵，不可更名。
export const modeStorageKey = 'luca-style-mode';
// 主題容器標記、套系與明暗的屬性名，tokens CSS 以三者同時存在作為選擇器。
export const themeAttribute = 'data-luca-theme';
export const suiteAttribute = 'data-suite';
export const modeAttribute = 'data-mode';

export type ThemeInitOptions = { suite?: StyleSuite };

// 回傳放進 <head> 的行內腳本字串：在 React 掛載前依已存偏好設定 <html> 的主題屬性，避免首屏先閃日間。
// suite 須與 ThemeProvider 的 suite 相同，否則掛載時會換一次套系；須搭配 target="document"，否則 <html> 上的屬性不會隨後續切換更新。
// 插入值都經 JSON.stringify 且 suite 為固定字面值；若日後接受任意字串，須另行跳脫 </script>。
export function themeInitScript({suite = 'vibrant'}: ThemeInitOptions = {}): string {
  const key = JSON.stringify(modeStorageKey);
  const root = 'document.documentElement';
  return `(function(){var m;try{m=localStorage.getItem(${key});}catch(e){}`
    + `if(m!=='light'&&m!=='dark'){try{m=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}catch(e){m='light';}}`
    + `${root}.setAttribute(${JSON.stringify(themeAttribute)},'');`
    + `${root}.setAttribute(${JSON.stringify(suiteAttribute)},${JSON.stringify(suite)});`
    + `${root}.setAttribute(${JSON.stringify(modeAttribute)},m);})();`;
}
