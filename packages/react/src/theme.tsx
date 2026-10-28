import { createContext, useContext, useEffect, useLayoutEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { modeAttribute, modeStorageKey, suiteAttribute, themeAttribute } from './theme-init.js';
import type { ColorMode, StyleSuite } from './theme-types.js';
export type { ColorMode, StyleSuite } from './theme-types.js';
export { themeInitScript, type ThemeInitOptions } from './theme-init.js';
export type AccentPalette = {primary:string; secondary?:string; soft?:string; ink?:string};
export type ThemeTarget = 'self' | 'document';
export type ThemeProviderProps = {
  suite?:StyleSuite;
  accent?:AccentPalette | {light:AccentPalette; dark:AccentPalette};
  // false 時完全不讀寫瀏覽器儲存，偏好只存在本次頁面。
  persist?:boolean;
  // document 時主題屬性與強調色變數套在 <html>，不另包外層元素。
  target?:ThemeTarget;
  children:ReactNode;
};
const ThemeContext = createContext<{mode:ColorMode; resolvedMode:'light'|'dark'; setMode:(mode:ColorMode)=>void} | null>(null);
function storedMode():ColorMode {
  try { const value = localStorage.getItem(modeStorageKey); return value === 'dark' || value === 'light' ? value : 'system'; } catch { return 'system'; }
}
export function ThemeProvider({suite='vibrant', accent, persist=true, target='self', children}: ThemeProviderProps) {
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
  const palette = accent && 'light' in accent ? accent[resolvedMode] : accent;
  // 主題屬性與強調色變數只算一份，依 target 套到外層 div 或 <html>。
  const attributes = {[themeAttribute]:'', [suiteAttribute]:suite, [modeAttribute]:resolvedMode};
  const variables:Record<string,string|undefined> = palette ? {'--accent':palette.primary, '--accent-secondary':palette.secondary, '--accent-soft':palette.soft, '--accent-ink':palette.ink} : {};
  const toDocument = target === 'document';
  const attributeKey = JSON.stringify(attributes), variableKey = JSON.stringify(variables);
  useLayoutEffect(() => {
    if (!toDocument) return;
    const root = document.documentElement;
    const applied:Record<string,string> = JSON.parse(attributeKey);
    const styles:Record<string,string|undefined> = JSON.parse(variableKey);
    for (const [name,value] of Object.entries(applied)) root.setAttribute(name,value);
    for (const [name,value] of Object.entries(styles)) if (value !== undefined) root.style.setProperty(name,value);
    // 卸載或改值時清掉本次套上的屬性與變數，避免殘留在 <html>。
    return () => {
      for (const name of Object.keys(applied)) root.removeAttribute(name);
      for (const name of Object.keys(styles)) root.style.removeProperty(name);
    };
  }, [toDocument, attributeKey, variableKey]);
  const value = {mode,resolvedMode,setMode};
  if (toDocument) return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
  return <ThemeContext.Provider value={value}><div {...attributes} style={palette ? variables as CSSProperties : undefined}>{children}</div></ThemeContext.Provider>;
}
export function useTheme() { const theme = useContext(ThemeContext); if(!theme) throw new Error('useTheme requires ThemeProvider'); return theme; }
