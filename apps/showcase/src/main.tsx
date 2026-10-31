import {Editorial} from './editorial';
import {NotFound} from './not-found';
import {ProductTemplate} from './product-template';
import {Components} from './components';
import {Foundations, type PreviewLevels} from './foundations';
import {isKnownRoute, isStateOverviewRoute, stripBase, withBase} from './routes';
import '@luca-style/react/fonts.css';
import { createRoot } from 'react-dom/client';
import { lazy, Suspense, useState } from 'react';
import { Navigation, ThemeProvider, useTheme, type StyleSuite, type ColorMode } from '@luca-style/react';
import '@luca-style/tokens/css';
import '@luca-style/react/css';
import './styles.css';

function App() {
  const [override, setOverride] = useState(false);
  const [suite, setSuite] = useState<StyleSuite>('vibrant');
  // 設計基礎頁的資訊密度與元件外形預覽；只在該頁傳給 ThemeProvider，換套系即回到新套系的預設（§5.3.2）。
  const [levels, setLevels] = useState<PreviewLevels>({});
  const changeSuite = (value:StyleSuite) => { setSuite(value); setLevels({}); };
  const onFoundations = stripBase(window.location.pathname) === '/foundations';
  return <ThemeProvider target="document" suite={suite} density={onFoundations ? levels.density : undefined} shape={onFoundations ? levels.shape : undefined} accent={override ? {light:"#9A4C32",dark:"#E8A18B",secondary:"#BD7454",soft:{light:"#F7F1EB",dark:"#382820"}} : undefined}><Content suite={suite} setSuite={changeSuite} override={override} setOverride={setOverride} levels={levels} setLevels={setLevels}/></ThemeProvider>;
}
function Content({suite,setSuite,override,setOverride,levels,setLevels}: {suite:StyleSuite; setSuite:(suite:StyleSuite)=>void; override:boolean; setOverride:(value:boolean)=>void; levels:PreviewLevels; setLevels:(levels:PreviewLevels)=>void}) {
  const {mode,resolvedMode,setMode} = useTheme();
  const suiteName = suite === 'vibrant' ? '精緻活力 · 潮汐' : '精緻專業 · 石墨紫';
  // route 為去掉 base 的路由；導覽連結含 base，currentPath 需同為含 base 的路徑才能比對 aria-current。
  const route = stripBase(window.location.pathname);
  const intro = route === '/templates/intro';
  const product = route === '/templates/product';
  const components = route === '/components';
  const foundations = route === '/foundations';
  const notFound = !isKnownRoute(route);
  return <div className="page">
    <Navigation currentPath={withBase(route)} brandHref={withBase('/')} items={[{label:"設計基礎",href:withBase("/foundations")},{label:"共用元件",href:withBase("/components")},{label:"產品範本",href:withBase("/templates/product")},{label:"介紹範本",href:withBase("/templates/intro")}]}/>
    <section className="theme-controls" aria-label="主題比較">
      <label>風格套系<select value={suite} onChange={e=>setSuite(e.target.value as StyleSuite)}><option value="vibrant">精緻活力 · 潮汐</option><option value="professional">精緻專業 · 石墨紫</option></select></label>
      <label>明暗模式<select value={mode} onChange={e=>setMode(e.target.value as ColorMode)}><option value="system">跟隨系統</option><option value="light">日間</option><option value="dark">暗黑</option></select></label>
    <label className="override-control"><span>專案強調色</span><span><input type="checkbox" checked={override} onChange={e=>setOverride(e.target.checked)}/>檢視專案強調色覆寫</span></label>
    </section><div className="status-preview" aria-label="操作狀態色對照"><span style={{color:'var(--success)'}}>成功 · 已儲存</span><span style={{color:'var(--warning)'}}>警告 · 請確認</span><span style={{color:'var(--error)'}}>錯誤 · 請重試</span></div><main>
      <p className="eyebrow">{notFound ? route : intro ? '/templates/intro' : product ? '/templates/product' : components ? '/components' : foundations ? '/foundations' : '/'} / {suiteName} / {resolvedMode === 'dark' ? '暗黑' : '日間'}</p>
      {notFound ? <NotFound path={route}/> : product ? <ProductTemplate/> : components ? <Components/> : foundations ? <Foundations suite={suite} levels={levels} setLevels={setLevels}/> : <Editorial intro={intro} suite={suite}/>}
    </main>
    <footer>Luca Style / {suiteName} · 字級提案 A</footer>
  </div>;
}
const root = createRoot(document.getElementById('root')!);
// import.meta.env.DEV 要直接寫在這裡：正式建置才會移除這個區塊與狀態總覽頁的 chunk。
if (import.meta.env.DEV && isStateOverviewRoute(stripBase(window.location.pathname))) {
  const StateOverview = lazy(() => import('./state-overview').then(module => ({default:module.StateOverview})));
  root.render(<ThemeProvider target="document"><Suspense fallback={null}><StateOverview/></Suspense></ThemeProvider>);
} else {
  root.render(<App />);
}
