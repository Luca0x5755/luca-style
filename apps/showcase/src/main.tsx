import {Editorial} from './editorial';
import {NotFound} from './not-found';
import {Product} from './product';
import {Components} from './components';
import {Foundations} from './foundations';
import {isKnownRoute, stripBase, withBase} from './routes';
import '@luca-style/react/fonts.css';
import { createRoot } from 'react-dom/client';
import { useLayoutEffect, useState } from 'react';
import { Navigation, ThemeProvider, useTheme, type StyleSuite, type ColorMode } from '@luca-style/react';
import '@luca-style/tokens/css';
import '@luca-style/react/css';
import './styles.css';

function App() {
  const [override, setOverride] = useState(false);
  const [suite, setSuite] = useState<StyleSuite>('vibrant');
  return <ThemeProvider suite={suite} accent={override ? {light:{primary:"#9A4C32",secondary:"#BD7454",soft:"#F7F1EB",ink:"#FFFFFF"},dark:{primary:"#E8A18B",secondary:"#E6BE70",soft:"#382820",ink:"#151A18"}} : undefined}><Content suite={suite} setSuite={setSuite} override={override} setOverride={setOverride}/></ThemeProvider>;
}
function Content({suite,setSuite,override,setOverride}: {suite:StyleSuite; setSuite:(suite:StyleSuite)=>void; override:boolean; setOverride:(value:boolean)=>void}) {
  const {mode,resolvedMode,setMode} = useTheme();
  useLayoutEffect(() => {
    document.documentElement.dataset.mode = resolvedMode;
  },[resolvedMode]);
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
      {notFound ? <NotFound path={route}/> : product ? <Product/> : components ? <Components/> : foundations ? <Foundations suite={suite}/> : <Editorial intro={intro} suite={suite}/>}
    </main>
    <footer>Luca Style / {suiteName} · 字級提案 A</footer>
  </div>;
}
createRoot(document.getElementById('root')!).render(<App />);
