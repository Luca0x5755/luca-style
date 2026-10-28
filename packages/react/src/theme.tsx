import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { modeAttribute, modeStorageKey, suiteAttribute, themeAttribute } from './theme-init.js';
import type { ColorMode, Density, Shape, StyleSuite } from './theme-types.js';
import { deriveAccent, type AccentInput } from '@luca-style/tokens/accent';
import tokenData from '@luca-style/tokens/data' with { type: 'json' };
export type { AccentInput } from '@luca-style/tokens/accent';
export type { ColorMode, Density, Shape, StyleSuite } from './theme-types.js';
export { themeInitScript, type ThemeInitOptions } from './theme-init.js';
export type ThemeTarget = 'self' | 'document';
// 資訊密度與元件外形的屬性名；只由 ThemeProvider 寫入，首屏腳本不處理（架構 §3.3）。
const densityAttribute = 'data-density';
const shapeAttribute = 'data-shape';
export type ThemeProviderProps = {
  suite?:StyleSuite;
  // 只有日間主色必填；其餘沒給時由 deriveAccent 推算（架構 §3.3）。
  accent?:AccentInput;
  // 資訊密度與元件外形可單獨覆寫；沒給時沿用風格套系的預設等級（ADR 0005）。
  density?:Density;
  shape?:Shape;
  // false 時完全不讀寫瀏覽器儲存，偏好只存在本次頁面。
  persist?:boolean;
  // document 時主題屬性與強調色變數套在 <html>，不另包外層元素。
  target?:ThemeTarget;
  children:ReactNode;
};
const ThemeContext = createContext<{mode:ColorMode; resolvedMode:'light'|'dark'; setMode:(mode:ColorMode)=>void} | null>(null);
// 彈出層（例如 Select 選單）的 portal 容器，不對外公開：target="self" 時是外層 div，主題屬性與行內強調色變數靠繼承套到彈出層；
// target="document" 或沒有 ThemeProvider 時為 null，交給 Base UI 預設的 document.body（<html> 已帶主題屬性）。
const PortalContainerContext = createContext<RefObject<HTMLDivElement | null> | null>(null);
export function usePortalContainer() { return useContext(PortalContainerContext); }
function storedMode():ColorMode {
  try { const value = localStorage.getItem(modeStorageKey); return value === 'dark' || value === 'light' ? value : 'system'; } catch { return 'system'; }
}
export function ThemeProvider({suite='vibrant', accent, density, shape, persist=true, target='self', children}: ThemeProviderProps) {
  const [mode, updateMode] = useState<ColorMode>(() => persist ? storedMode() : 'system');
  const [dark, setDark] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setDark(media.matches);
    sync(); media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  const setMode = (value:ColorMode) => {
    updateMode(value);
    if (!persist) return;
    try { if(value === 'system') localStorage.removeItem(modeStorageKey); else localStorage.setItem(modeStorageKey,value); } catch { /* 儲存不可用時維持目前頁面的選擇。 */ }
  };
  const resolvedMode = mode === 'system' ? dark ? 'dark' : 'light' : mode;
  // 主題屬性與強調色變數只算一份，依 target 套到外層 div 或 <html>。
  // density、shape 沒給就不寫屬性，tokens CSS 的套系區塊即為預設值，畫面與 0.1.0 相同（PR-STYLE-29）。
  const attributes:Record<string,string> = {[themeAttribute]:'', [suiteAttribute]:suite, [modeAttribute]:resolvedMode,
    ...(density && {[densityAttribute]:density}), ...(shape && {[shapeAttribute]:shape})};
  // 中性色取自設計變數輸出，與建置時推算套系預設色用的是同一組值。
  // 推算要走數次明度搜尋，只在輸入、套系或明暗改變時重算；accent 物件常是每次 render 新建，故以內容當鍵。
  const accentKey = accent ? JSON.stringify(accent) : '';
  const variables = useMemo<Record<string,string>>(() => accentKey
    ? Object.fromEntries(Object.entries(deriveAccent(JSON.parse(accentKey), resolvedMode, tokenData[suite][resolvedMode])).map(([name,value]) => [`--${name}`, value]))
    : {}, [accentKey, suite, resolvedMode]);
  const toDocument = target === 'document';
  const container = useRef<HTMLDivElement>(null);
  const attributeKey = JSON.stringify(attributes), variableKey = JSON.stringify(variables);
  useLayoutEffect(() => {
    if (!toDocument) return;
    const root = document.documentElement;
    const applied:Record<string,string> = JSON.parse(attributeKey);
    const styles:Record<string,string> = JSON.parse(variableKey);
    for (const [name,value] of Object.entries(applied)) root.setAttribute(name,value);
    for (const [name,value] of Object.entries(styles)) root.style.setProperty(name,value);
    // 卸載或改值時清掉本次套上的屬性與變數，避免殘留在 <html>。
    return () => {
      for (const name of Object.keys(applied)) root.removeAttribute(name);
      for (const name of Object.keys(styles)) root.style.removeProperty(name);
    };
  }, [toDocument, attributeKey, variableKey]);
  const value = {mode,resolvedMode,setMode};
  if (toDocument) return <ThemeContext.Provider value={value}><PortalContainerContext.Provider value={null}>{children}</PortalContainerContext.Provider></ThemeContext.Provider>;
  return <ThemeContext.Provider value={value}><PortalContainerContext.Provider value={container}><div ref={container} {...attributes} style={accent ? variables as CSSProperties : undefined}>{children}</div></PortalContainerContext.Provider></ThemeContext.Provider>;
}
export function useTheme() { const theme = useContext(ThemeContext); if(!theme) throw new Error('useTheme requires ThemeProvider'); return theme; }
