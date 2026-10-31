import {useEffect,useLayoutEffect,useRef,useState,type ReactNode,type RefObject} from 'react';
import {Button,ContentState,type ColorMode,type StyleSuite} from '@luca-style/react';
import type {ProductState} from './product';
import {overviewScreens,type OverviewScreen} from './state-overview-screens';
import type {FrameReport} from './state-overview-frame';
import {stateOverviewFrameRoute,withBase} from './routes';
import './state-overview.css';

const cells:{state:ProductState;label:string}[]=[{state:'loading',label:'Loading'},{state:'empty',label:'Empty'},{state:'error',label:'Error'},{state:'success',label:'Success'}];
const widths={desktop:1280,mobile:390} as const;
type WidthChoice=keyof typeof widths;
type Theme={suite:StyleSuite;mode:ColorMode};
const frameTimeout=20_000;

function CellFrame({src,label,width,scale}:{src:string;label:string;width:number;scale:number}){
 const frame=useRef<HTMLIFrameElement>(null);
 const [report,setReport]=useState<FrameReport|{status:'loading'}>({status:'loading'});
 useEffect(()=>{
  const receive=(event:MessageEvent<FrameReport>)=>{if(event.source===frame.current?.contentWindow&&event.origin===window.location.origin)setReport(event.data);};
  window.addEventListener('message',receive);
  // 文件載不到時格內無法回報，要靠逾時。之後才收到 ready 仍會照常顯示。
  const timer=setTimeout(()=>setReport(current=>current.status==='loading'?{status:'failed'}:current),frameTimeout);
  return ()=>{window.removeEventListener('message',receive);clearTimeout(timer);};
 },[]);
 const ready=report.status==='ready';
 return <div className="state-overview-frame" style={{width:width*scale,height:ready?report.height*scale:undefined}}>
  {report.status==='loading'&&<ContentState state="loading" title="此格載入中"/>}
  {report.status==='failed'&&<ContentState state="error" title="此格無法呈現" description="其他格與切換控制照常可用。"/>}
  <iframe ref={frame} src={src} title={label} style={{width,height:ready?report.height:0,transform:`scale(${scale})`,visibility:ready?'visible':'hidden'}}/>
 </div>;
}
function Cell({screen,direction,state,label,theme,width,scale,children}:{screen:OverviewScreen;direction:string|null;state:ProductState;label:string;theme:Theme;width:number;scale:number;children?:ReactNode}){
 const src=withBase(`${stateOverviewFrameRoute}?${new URLSearchParams({screen:screen.route,state,...theme,...(direction&&{direction})})}`);
 // 換網址時用 key 重新掛載 iframe，而不是改 src：改 src 會多一筆瀏覽歷史，也才會回到載入提示。
 return <section className="state-overview-cell" aria-label={label}><h2>{label}</h2>{children}<CellFrame key={src} src={src} label={label} width={width} scale={scale}/></section>;
}
// 格子並排方式由專案負責人決定（ISSUE-003）：scroll 是原尺寸橫向捲動，fit 是縮小並排看全貌。
// scroll 是暫定預設，尚未決定；選定後刪掉另一個分支、這個參數和 useFitScale。
const layout=new URLSearchParams(window.location.search).get('layout')==='fit'?'fit':'scroll';
// fit 時算出目前的格子剛好放進容器的比例；scroll 固定為 1。
function useFitScale(row:RefObject<HTMLDivElement|null>,width:number,count:number){
 const [scale,setScale]=useState(1);
 useLayoutEffect(()=>{
  if(layout!=='fit'||!row.current) return;
  const node=row.current;
  const measure=()=>{const gap=parseFloat(getComputedStyle(node).columnGap)||0;setScale(Math.min(1,(node.clientWidth-gap*(count-1))/(count*width)));};
  const observer=new ResizeObserver(measure);
  measure();observer.observe(node);
  return ()=>observer.disconnect();
 },[row,width,count]);
 return scale;
}
// 狀態總覽頁（§5.3.7）：只在開發環境由 main.tsx 載入，不屬於樣張網站。
// 切換只改各格的網址，外殼不用 setMode，所以不會寫入其他頁面共用的明暗偏好。
export function StateOverview(){
 const [suite,setSuite]=useState<StyleSuite>('vibrant');
 const [mode,setMode]=useState<ColorMode>('light');
 const [widthChoice,setWidthChoice]=useState<WidthChoice>('desktop');
 const row=useRef<HTMLDivElement>(null);
 const width=widths[widthChoice];
 const [chosen,setChosen]=useState<string|null>(null);
 const screen=overviewScreens.at(0);
 // 兩個方向先只比 Success，一次看 8 格太難比（ISSUE-001）；選定後才看該方向的四種狀態。
 const comparing=screen?.directions.length===2&&chosen===null;
 const scale=useFitScale(row,width,comparing?2:cells.length);
 if(!screen) return <main className="state-overview"><h1>狀態總覽頁</h1><ContentState state="empty" title="此頁沒有可審的畫面" description="尚未納入任何畫面。"/></main>;
 const shared={screen,theme:{suite,mode},width,scale};
 return <main className="state-overview"><h1>狀態總覽頁 · {screen.route}{chosen!==null&&` · ${chosen}`}</h1>
  <section className="theme-controls" aria-label="切換控制">
   <label>風格套系<select value={suite} onChange={e=>setSuite(e.target.value as StyleSuite)}><option value="vibrant">精緻活力</option><option value="professional">精緻專業</option></select></label>
   <label>明暗模式<select value={mode} onChange={e=>setMode(e.target.value as ColorMode)}><option value="light">日間</option><option value="dark">暗黑</option></select></label>
   <label>寬度<select value={widthChoice} onChange={e=>setWidthChoice(e.target.value as WidthChoice)}><option value="desktop">桌機 1280</option><option value="mobile">手機 390</option></select></label>
  </section>
  <div ref={row} className="state-overview-cells">{comparing
   ?screen.directions.map(({name})=><Cell {...shared} key={name} direction={name} state="success" label={`${name} · Success`}><div><Button variant="secondary" onClick={()=>setChosen(name)}>選定 {name}</Button></div></Cell>)
   :cells.map(({state,label})=><Cell {...shared} key={state} direction={chosen} state={state} label={label}/>)}</div></main>;
}
