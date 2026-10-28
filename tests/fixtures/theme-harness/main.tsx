// ThemeProvider 測試載具：以 query string 選擇 persist、target、accent（JSON）、suite、density 與 shape，
// 頁上提供切換明暗與卸載的按鈕，以及一組元件樣本供讀取計算樣式。
import '@luca-style/tokens/css';
import '../../../packages/react/src/styles.css';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, ContentState, DataTable, MetricCard, TextField, ThemeProvider, useTheme, type AccentInput, type Density, type Shape, type StyleSuite, type ThemeTarget } from '@luca-style/react';

const params = new URLSearchParams(window.location.search);
const persist = params.get('persist') !== '0';
const target:ThemeTarget = params.get('target') === 'document' ? 'document' : 'self';
// accent=none 表示不覆寫專案強調色。
const accentParam = params.get('accent') ?? '{"light":"#9A4C32"}';
const accent:AccentInput | undefined = accentParam === 'none' ? undefined : JSON.parse(accentParam);
const suite = (params.get('suite') ?? undefined) as StyleSuite | undefined;
const density = (params.get('density') ?? undefined) as Density | undefined;
const shape = (params.get('shape') ?? undefined) as Shape | undefined;

function ModeButtons() {
  const {resolvedMode, setMode} = useTheme();
  return <p>
    <output aria-label="目前明暗">{resolvedMode}</output>
    <button onClick={() => setMode('dark')}>暗黑</button>
    <button onClick={() => setMode('light')}>日間</button>
    <button onClick={() => setMode('system')}>跟隨系統</button>
  </p>;
}

function Samples() {
  return <section aria-label="元件樣本">
    <Button>主要按鈕</Button>
    <Button variant="secondary">次要按鈕</Button>
    <TextField label="樣本欄位"/>
    <MetricCard label="樣本指標" eyebrow="本月" value="128,640" detail="較上月增加" highlight/>
    <DataTable caption="樣本表格" columns={[{key:'name', heading:'名稱', render:(row:{name:string}) => row.name}]} rows={[{name:'第一列'}]} rowKey={row => row.name}/>
    <ContentState state="empty" title="樣本空白" description="尚無內容。"/>
  </section>;
}

function Harness() {
  const [mounted, setMounted] = useState(true);
  return <>
    <button onClick={() => setMounted(false)}>卸載</button>
    {mounted && <ThemeProvider persist={persist} target={target} accent={accent} suite={suite} density={density} shape={shape}><ModeButtons/><Samples/></ThemeProvider>}
  </>;
}

createRoot(document.getElementById('root')!).render(<Harness/>);
