import tokens from '@luca-style/tokens/data';
import typography from '@luca-style/tokens/typography';
import {type CSSProperties, useEffect, useState} from 'react';
import {Button, ContentState, type Density, type Shape, type StyleSuite, useTheme} from '@luca-style/react';
import interLicense from '@luca-style/react/licenses/inter?url';
import notoLicense from '@luca-style/react/licenses/notosanstc?url';
import monoLicense from '@luca-style/react/licenses/ibmplexmono?url';

type SampleState = 'success' | 'loading' | 'empty' | 'error';
export type PreviewLevels = {density?:Density; shape?:Shape};
// 套系的預設等級，只用來決定切換的預設選項；實際數值由 tokens CSS 的套系區塊提供（前端規格 §5.4）。
const suiteDefaults:Record<StyleSuite,{density:Density; shape:Shape}> = {vibrant:{density:'standard', shape:'rounded'}, professional:{density:'standard', shape:'sharp'}};
const densityLabels:Record<Density,string> = {compact:'精簡', standard:'標準', comfortable:'寬鬆'};
const shapeLabels:Record<Shape,string> = {rounded:'圓潤', sharp:'俐落'};
// 隨密度與外形改變的變數；頁上顯示的值改讀 <html> 的計算樣式，才會反映目前等級。
const levelVariables = ['control-height','card-padding','gap-section','radius-card','radius-control','border-width','metric-border-left','metric-shadow'] as const;
type LevelValues = Record<typeof levelVariables[number], string>;
const sections = ['色彩，是有意義的角色','文字，保留清楚的層次','空間，讓資訊各就其位','外形與動態'];
const roles = {hero:'介紹頁主標',title:'頁面標題',section:'區塊標題',card:'卡片標題',body:'正文',control:'表單、按鈕',secondary:'表格、次要文字',helper:'輔助標籤'};
const colorLabels = {accent:'主色', 'accent-secondary':'點綴', bg:'背景', surface:'主要表面', 'surface-subtle':'次級表面', text:'主要文字', muted:'次要文字', border:'邊界', 'control-border':'操作邊界', 'accent-soft':'柔和強調表面', success:'成功',warning:'警告',error:'錯誤'};

export function Foundations({suite,levels,setLevels}: {suite:StyleSuite; levels:PreviewLevels; setLevels:(levels:PreviewLevels)=>void}) {
  const {resolvedMode} = useTheme();
  const theme = tokens[suite][resolvedMode];
  const [state,setState] = useState<SampleState>('success');
  const density = levels.density ?? suiteDefaults[suite].density, shape = levels.shape ?? suiteDefaults[suite].shape;
  // 首次 render 先用套系資料；ThemeProvider 在 layout effect 寫入屬性，這裡用 effect 才讀得到寫入後的值。
  const [measured,setMeasured] = useState<LevelValues>();
  useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    setMeasured(Object.fromEntries(levelVariables.map(name => [name, style.getPropertyValue(`--${name}`).trim()])) as LevelValues);
  }, [suite, resolvedMode, levels]);
  const level:LevelValues = measured ?? theme;
  return <div className="foundations">
    <h1 className="page-title">設計基礎</h1><p>色彩、文字與空間，從相同的角色開始。</p>
    <div className="level-controls">
      <label className="sample-control">資訊密度<select value={density} onChange={e=>setLevels({...levels, density:e.target.value as Density})}>{Object.entries(densityLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <label className="sample-control">元件外形<select value={shape} onChange={e=>setLevels({...levels, shape:e.target.value as Shape})}>{Object.entries(shapeLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    <label className="sample-control">樣張狀態<select value={state} onChange={e=>setState(e.target.value as SampleState)}><option value="success">Success · 正常內容</option><option value="loading">Loading · 載入中</option><option value="empty">Empty · 尚無內容</option><option value="error">Error · 載入失敗</option></select></label>
    {state !== 'success' && <ContentState state={state} title={state === 'loading' ? '視覺規則載入中' : state === 'empty' ? '目前沒有可顯示的規則內容' : '視覺規則載入失敗'} description={state === 'loading' ? '正在準備規則內容，請稍候。' : state === 'empty' ? '保留套系與模式選擇，隨時切換檢視。' : '請重試以重新顯示規則內容。'} onRetry={()=>setState('success')}/>}
    <section aria-labelledby="foundation-color"><h2 id="foundation-color">{sections[0]}</h2>{state === 'success' && <>
      <p>色票顯示套系原始值；專案強調色覆寫僅供比較操作元件。</p><div className="color-grid">{Object.entries(colorLabels).map(([key,label])=><div className="color-item" data-color={key} key={key}><div className="color-chip" style={{background:theme[key as keyof typeof theme]}}/><strong>{label}</strong><code>{theme[key as keyof typeof theme]}</code><small>{key}</small></div>)}</div>
      <p>操作結果使用成功、警告與錯誤角色。交易漲跌等業務資料色由使用端專案獨立定義。</p>
    </>}</section>
    <section aria-labelledby="foundation-type"><h2 id="foundation-type">{sections[1]}</h2>{state === 'success' && <>
      <p>提案 A · 英文 Inter、中文 Noto Sans TC、資料 IBM Plex Mono。正文與操作文字在手機維持 16px。</p>
      {Object.entries(typography).map(([key,value])=><div className="type-row" key={key}><small>{roles[key as keyof typeof roles]} · 手機 {value.mobile} / 平板 {value.tablet} / 電腦 {value.desktop} · {value.weight} / {value.lineHeight}</small><p data-type={key} style={{fontSize:`var(--type-${key}-size)`,fontWeight:`var(--type-${key}-weight)`,lineHeight:`var(--type-${key}-line-height)`} as CSSProperties}>{key === 'hero' ? '讓重要的事，更清楚。' : key === 'body' ? '保留舒適的閱讀節奏，讓每個專案都有一致的起點。' : key === 'control' ? '儲存設定 Save changes' : '同一套規則，同樣清楚。'}</p></div>)}
      <div className="type-row"><small>資料數字 · IBM Plex Mono / 600</small><p className="data-specimen">128,640.00</p></div>
      <p className="font-licenses">字體授權：<a href={interLicense}>Inter OFL</a> · <a href={notoLicense}>Noto Sans TC OFL</a> · <a href={monoLicense}>IBM Plex Mono OFL</a></p>
    </>}</section>
    <section aria-labelledby="foundation-space"><h2 id="foundation-space">{sections[2]}</h2>{state === 'success' && <>
      <div className="spacing-grid">{Object.entries(theme).filter(([key])=>key.startsWith('space-')).map(([key,value])=><div key={key}><div className="space-bar" style={{height:`var(--${key})`}}/><code>{value}</code><small>{key}</small></div>)}</div>
      <p>{densityLabels[density]}密度：操作元件高度 <code>{level['control-height']}</code>，容器內距 <code>{level['card-padding']}</code>，區塊間距 <code>{level['gap-section']}</code>；文字角色維持一致。</p>
    </>}</section>
    <section aria-labelledby="foundation-shape"><h2 id="foundation-shape">{sections[3]}</h2>{state === 'success' && <>
      <div className="shape-demo"><p>{shapeLabels[shape]}外形：容器圓角 <code>{Number.parseFloat(level['radius-card'])}rem</code> · 操作元件 <code>{Number.parseFloat(level['radius-control'])}rem</code></p><Button>操作元件</Button><p>邊界 {level['border-width']} · 指標左邊界 {level['metric-border-left']} · 陰影 {level['metric-shadow']}</p></div>
      <p>短而克制：回饋 {theme['motion-feedback']}、一般切換 {theme['motion-standard']}、區塊進出 {theme['motion-region']}。減少動態設定下，取消非必要的位移與淡入淡出。</p>
    </>}</section>
  </div>;
}
