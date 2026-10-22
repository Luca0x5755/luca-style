import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
export type StyleSuite = 'vibrant' | 'professional';
export type ColorMode = 'system' | 'light' | 'dark';
export type AccentPalette = {primary:string; secondary?:string; soft?:string; ink?:string};
const ThemeContext = createContext<{mode:ColorMode; resolvedMode:'light'|'dark'; setMode:(mode:ColorMode)=>void} | null>(null);
function storedMode():ColorMode {
  try { const value = localStorage.getItem('luca-style-mode'); return value === 'dark' || value === 'light' ? value : 'system'; } catch { return 'system'; }
}
export function ThemeProvider({suite='vibrant', accent, children}: {suite?:StyleSuite; accent?:AccentPalette | {light:AccentPalette; dark:AccentPalette}; children:ReactNode}) {
  const [mode, updateMode] = useState<ColorMode>(storedMode);
  const [dark, setDark] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setDark(media.matches);
    sync(); media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  const setMode = (value:ColorMode) => {
    updateMode(value);
    try { if(value === 'system') localStorage.removeItem('luca-style-mode'); else localStorage.setItem('luca-style-mode',value); } catch { /* 儲存不可用時維持目前頁面的選擇。 */ }
  };
  const resolvedMode = mode === 'system' ? dark ? 'dark' : 'light' : mode;
  const palette = accent && 'light' in accent ? accent[resolvedMode] : accent;
  const style = palette ? {'--accent':palette.primary, '--accent-secondary':palette.secondary, '--accent-soft':palette.soft, '--accent-ink':palette.ink} as CSSProperties : undefined;
  return <ThemeContext.Provider value={{mode,resolvedMode,setMode}}><div data-luca-theme="" data-suite={suite} data-mode={resolvedMode} style={style}>{children}</div></ThemeContext.Provider>;
}
export function useTheme() { const theme = useContext(ThemeContext); if(!theme) throw new Error('useTheme requires ThemeProvider'); return theme; }
