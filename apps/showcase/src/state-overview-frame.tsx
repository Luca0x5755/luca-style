import {Component,useEffect,useLayoutEffect,type ReactNode} from 'react';
import {ThemeProvider,useTheme,type ColorMode,type StyleSuite} from '@luca-style/react';
import type {ProductState} from './product';
import {overviewScreens} from './state-overview-screens';

export type FrameReport={status:'ready';height:number}|{status:'failed'};
const report=(message:FrameReport)=>window.parent.postMessage(message,window.location.origin);
// 畫面、狀態與主題都由網址參數傳入（PR-REVIEW-05）；外殼只換網址。
const params=new URLSearchParams(window.location.search);
const suite:StyleSuite=params.get('suite')==='professional'?'professional':'vibrant';
const mode:ColorMode=params.get('mode')==='dark'?'dark':'light';

// ThemeProvider 沒有 mode prop，只能在子元件設定；layout effect 會在繪製前重新渲染。
function ApplyMode(){
 const {setMode}=useTheme();
 useLayoutEffect(()=>setMode(mode),[setMode]);
 return null;
}
// 量 #root 而不是 documentElement：<html> 帶 min-height:100vh，量它高度會縮不回來。
function ReportReady(){
 useEffect(()=>{
  const root=document.getElementById('root')!;
  const observer=new ResizeObserver(()=>report({status:'ready',height:Math.ceil(root.getBoundingClientRect().height)}));
  observer.observe(root);
  return ()=>observer.disconnect();
 },[]);
 return null;
}
class FrameBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(){report({status:'failed'});}
 render(){return this.state.failed?null:this.props.children;}
}
const productStates:ProductState[]=['loading','empty','error','success'];
function FrameScreen(){
 const screen=overviewScreens.find(item=>item.route===params.get('screen'));
 const state=productStates.find(item=>item===params.get('state'));
 // 一個方向時網址不帶 direction；兩個方向要指名，參數打錯才不會默默呈現第一個、審錯版面。
 const direction=screen?.directions.length===1?screen.directions[0]:screen?.directions.find(item=>item.name===params.get('direction'));
 if(!direction||!state) throw new Error('格內網址缺少可呈現的畫面或狀態');
 return direction.render(state);
}
// 一格的內容。target="document" 只影響這個 iframe 自己的文件，所以切換範圍就是這一格，<html> 也才和 /templates/product 相同。
// persist={false} 不讀寫偏好；首屏腳本仍會先寫入已存的模式，所以外殼在收到 ready 前都隱藏 iframe。
export function StateOverviewFrame(){
 return <ThemeProvider target="document" persist={false} suite={suite}><ApplyMode/><FrameBoundary><div className="page"><main><FrameScreen/></main></div><ReportReady/></FrameBoundary></ThemeProvider>;
}
