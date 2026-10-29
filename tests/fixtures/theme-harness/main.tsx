// ThemeProvider 測試載具：以 query string 選擇 persist、target、accent（JSON）、suite、density 與 shape，
// 頁上提供切換明暗與卸載的按鈕，以及一組元件樣本供讀取計算樣式；Select 樣本用來驗證 portal 出去的選單仍套到主題（ISSUE-009）。
import '@luca-style/tokens/css';
import '../../../packages/react/src/styles.css';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Button, Checkbox, ContentState, DataTable, MetricCard, Select, TextField, ThemeProvider, useTheme, type AccentInput, type Density, type Shape, type StyleSuite, type ThemeTarget } from '@luca-style/react';

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
    <Select label="樣本選單" defaultValue="vibrant"><option value="vibrant">精緻活力 · 潮汐</option><option value="professional">精緻專業 · 石墨紫</option><option value="legacy" disabled>舊版主題</option></Select>
  </section>;
}

// 0.1.0 原生 select 寫法的相容樣本：受控 value／onChange、name 送出、helper、error、aria-describedby、disabled、沒有 value 的 <option>（包在 Fragment 裡）。
function SelectCompatibility() {
  const [frequency, setFrequency] = useState('weekly');
  const [submitted, setSubmitted] = useState('');
  return <form aria-label="選單相容性" onSubmit={event => { event.preventDefault(); setSubmitted(JSON.stringify([...new FormData(event.currentTarget)])); }}>
    <Select label="受控選單" name="frequency" value={frequency} onChange={event => setFrequency(event.target.value)} helper="每週寄一次摘要。"><option value="weekly">每週</option><option value="daily">每日</option></Select>
    <output aria-label="受控值">{frequency}</output>
    <Select label="文字當值" name="category"><><option>個人計畫</option><option>團隊活動</option></></Select>
    <Select label="錯誤選單" error="請選擇分類。" aria-describedby="select-note"><option value="a">甲</option></Select>
    <p id="select-note">另有補充說明。</p>
    <Select label="停用選單" disabled><option value="fixed">無法變更</option></Select>
    <button type="submit">送出選單</button>
    <output aria-label="送出內容">{submitted}</output>
  </form>;
}

// 0.1.0 寫法的相容樣本（ISSUE-010）：Button、TextField、Checkbox 的受控值、事件、name 送出、aria-*、data-*。
function ControlCompatibility() {
  const [text, setText] = useState('初值');
  const [agreed, setAgreed] = useState(false);
  const [events, setEvents] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState('');
  const log = (entry:string) => setEvents(list => [...list, entry]);
  return <form aria-label="控制項相容性" onSubmit={event => { event.preventDefault(); setSubmitted(JSON.stringify([...new FormData(event.currentTarget)])); }}>
    <TextField label="受控欄位" name="title" value={text} onChange={event => setText(event.target.value)} onFocus={() => log('欄位 focus')} onBlur={() => log('欄位 blur')} helper="提示文字" data-sample="text" required placeholder="輸入" maxLength={20}/>
    <output aria-label="欄位值">{text}</output>
    <TextField label="錯誤欄位" error="格式不對" aria-describedby="control-note"/>
    <p id="control-note">補充說明</p>
    <TextField label="預設值欄位" defaultValue="甲" className="extra"/>
    <Checkbox label="受控核取" name="agree" value="yes" checked={agreed} onChange={event => setAgreed(event.target.checked)} onFocus={() => log('核取 focus')} helper="勾選說明" data-sample="box"/>
    <output aria-label="核取值">{String(agreed)}</output>
    <Checkbox label="預設勾選" name="opt" defaultChecked className="extra"/>
    <Checkbox label="錯誤核取" error="必須勾選" aria-describedby="control-note"/>
    <Checkbox label="停用核取" name="off" disabled defaultChecked/>
    <Button type="submit" onClick={() => log('按鈕 click')} data-sample="button" aria-label="送出控制項">送出</Button>
    <Button type="button" variant="secondary" className="extra" title="次要提示">次要</Button>
    <Button loading>處理</Button>
    <output aria-label="事件紀錄">{events.join(',')}</output>
    <output aria-label="控制項送出內容">{submitted}</output>
  </form>;
}

function Harness() {
  const [mounted, setMounted] = useState(true);
  return <>
    <button onClick={() => setMounted(false)}>卸載</button>
    {mounted && <ThemeProvider persist={persist} target={target} accent={accent} suite={suite} density={density} shape={shape}><ModeButtons/><Samples/><SelectCompatibility/><ControlCompatibility/></ThemeProvider>}
  </>;
}

createRoot(document.getElementById('root')!).render(<Harness/>);
