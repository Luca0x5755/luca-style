// ThemeProvider 測試載具：以 query string 選擇 persist、target 與 accent（JSON），頁上提供切換明暗與卸載的按鈕。
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, useTheme, type AccentInput, type ThemeTarget } from '@luca-style/react';

const params = new URLSearchParams(window.location.search);
const persist = params.get('persist') !== '0';
const target:ThemeTarget = params.get('target') === 'document' ? 'document' : 'self';
const accent:AccentInput = JSON.parse(params.get('accent') ?? '{"light":"#9A4C32"}');

function ModeButtons() {
  const {resolvedMode, setMode} = useTheme();
  return <p>
    <output aria-label="目前明暗">{resolvedMode}</output>
    <button onClick={() => setMode('dark')}>暗黑</button>
    <button onClick={() => setMode('light')}>日間</button>
    <button onClick={() => setMode('system')}>跟隨系統</button>
  </p>;
}

function Harness() {
  const [mounted, setMounted] = useState(true);
  return <>
    <button onClick={() => setMounted(false)}>卸載</button>
    {mounted && <ThemeProvider persist={persist} target={target} accent={accent}><ModeButtons/></ThemeProvider>}
  </>;
}

createRoot(document.getElementById('root')!).render(<Harness/>);
